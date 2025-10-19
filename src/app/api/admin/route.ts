import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { Canvas, createCanvas } from 'canvas';
import { createWorker, RecognizeResult } from 'tesseract.js';
import axios from 'axios';
import sharp from 'sharp';


(global as any).fetch = fetch;

// Worker config
// For Vercel/serverless environments
// Disable worker in serverless environment
if (typeof window === 'undefined') {
  // Server environment
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = false;
} else {
  // Client environment
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.js';
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Types for extracted data
interface TextData {
  rawText: string;
  cleanedText: string;
  correctAnswerPattern: string | null;
  confidence: number;
}

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  confidence: string;
  page?: number | string;
  extractionMethod?: string;
  patternDetected?: string;
}

interface PDFInfo {
  isTextBased: boolean;
  numPages: number;
  sampleText: string;
}

// Text cleaning functions
function cleanText(text: string | null): string {
  if (!text) return '';
  
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

function cleanOCRText(text: string | null): string {
  if (!text) return '';
  
  return text
    .replace(/\n\s*\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/([a-zA-Z])\.([a-zA-Z])/g, '$1. $2')
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .trim();
}

// Pattern detection
function findCorrectAnswerByPatterns(text: string): string | null {
  const patterns = [
    /✓\s*[A-D]/gi,
    /\*\s*[A-D]/gi,
    /\[[xX✓]\][A-D]/gi,
    /[A-D]\s*\(correct\)/gi,
    /[A-D]\s*✅/gi,
    /[A-D].*?\[answer\]/gi,
    /correct.*?[A-D]/gi,
    /answer.*?[A-D]/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      const answerChar = matches[0].match(/[A-D]/i);
      if (answerChar) {
        return answerChar[0].toUpperCase();
      }
    }
  }
  return null;
}

// Detect PDF type from buffer
async function detectPDFType(buffer: Buffer): Promise<PDFInfo> {
  try {
    console.log('🔍 Detecting PDF type...');
    const uint8Array = new Uint8Array(buffer);
    
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      verbosity: 0,
      stopAtErrors: false,
      maxImageSize: -1,
      disableFontFace: true,

    });
    
    const pdf = await loadingTask.promise;
    
    let textContent = '';
    let hasSubstantialText = false;
    
    const pagesToCheck = Math.min(3, pdf.numPages);
    console.log(`Checking ${pagesToCheck} pages for text content...`);
    
    for (let i = 1; i <= pagesToCheck; i++) {
      try {
        console.log(`Analyzing page ${i} for text...`);
        const page = await pdf.getPage(i);
        const textContentObj = await page.getTextContent({
    
          includeMarkedContent: true
        });
        
const pageText = textContentObj.items
  .map(item => 'str' in item ? item.str : '')
  .join(' ');
        textContent += pageText + ' ';
        
        console.log(`Page ${i} has ${pageText.length} characters`);
        
        if (pageText.length > 100) {
          hasSubstantialText = true;
          console.log(`✅ Page ${i} has substantial text`);
        }
        
      } catch (pageError) {
        console.log(`⚠️ Page ${i} text extraction had issues, but continuing...`);
      }
    }
    
    await pdf.destroy();
    
    const cleanTextContent = cleanText(textContent);
    const isTextBased = cleanTextContent.length > 300 || hasSubstantialText;
    
    console.log(`📄 PDF type: ${isTextBased ? 'TEXT-BASED' : 'IMAGE-BASED'}`);
    console.log(`📊 Sample text length: ${cleanTextContent.length} characters`);
    console.log(`📝 Has substantial text: ${hasSubstantialText}`);
    
    return {
      isTextBased,
      numPages: pdf.numPages,
      sampleText: cleanTextContent.substring(0, 500)
    };
  } catch (error) {
    console.error('❌ Error detecting PDF type:', error);
    return {
      isTextBased: false,
      numPages: 0,
      sampleText: ''
    };
  }
}

// Extract text directly from PDF (for text-based PDFs)
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('📖 Extracting text directly from PDF...');
    const uint8Array = new Uint8Array(buffer);
    
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      verbosity: 0,
      stopAtErrors: false,
      maxImageSize: -1,
      disableFontFace: true,
 
      isEvalSupported: false,
      disableRange: false,
      disableStream: false,
      disableAutoFetch: false
    });
    
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    console.log(`Processing ${pdf.numPages} pages...`);
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        console.log(`Extracting text from page ${i}...`);
        const page = await pdf.getPage(i);
        
       const textContent = await page.getTextContent({
  includeMarkedContent: true
});
const pageText = textContent.items
  .map(item => 'str' in item ? item.str : '')
  .filter(str => str.trim().length > 0)
  .join(' ');
        
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        console.log(`✅ Page ${i}: Extracted ${pageText.length} characters`);
        
      } catch (pageError) {
        console.log(`⚠️ Page ${i} extraction had issues: ${(pageError as Error).message}`);
        fullText += `\n--- Page ${i} ---\n[Text extraction partially failed]\n`;
      }
    }
    
    await pdf.destroy();
    
    const cleanedText = cleanText(fullText);
    console.log(`✅ Text extraction completed: ${cleanedText.length} characters`);
    
    return cleanedText;
  } catch (error) {
    console.error('❌ Error extracting text from PDF:', error);
    throw error;
  }
}

// Convert PDF to images (for image-based PDFs)
async function convertPDFToImages(buffer: Buffer): Promise<{ page: number; imageBuffer: Buffer; width: number; height: number }[]> {
  try {
    console.log('🖼️ Converting PDF to high-quality images...');
    const uint8Array = new Uint8Array(buffer);
    
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      disableFontFace: true,
      verbosity: 0
    });
    
    const pdf = await loadingTask.promise;
    
    console.log(`PDF has ${pdf.numPages} pages`);
    
    const pageImages: { page: number; imageBuffer: Buffer; width: number; height: number }[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Converting page ${i} to image...`);
      const page = await pdf.getPage(i);
      
      const viewport = page.getViewport({ scale: 2.5 });
      
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      context.fillStyle = 'white';
      context.fillRect(0, 0, viewport.width, viewport.height);
      
  const renderContext = {
  canvasContext: context as any,
  viewport: viewport
};
      
      await page.render(renderContext).promise;
      
      const imageBuffer = canvas.toBuffer('image/png');
      pageImages.push({
        page: i,
        imageBuffer,
        width: viewport.width,
        height: viewport.height
      });
      
      console.log(`✅ Page ${i} converted (${viewport.width}x${viewport.height})`);
    }
    
    await pdf.destroy();
    return pageImages;
  } catch (error) {
    console.error('❌ Error converting PDF to images:', error);
    throw error;
  }
}

// OCR extraction for image-based PDFs
async function extractTextWithOCR(imageBuffer: Buffer, pageNum: number): Promise<TextData> {
  console.log(`🔍 Performing OCR on page ${pageNum}...`);
  
  const worker = await createWorker('eng');
  
  try {
await worker.setParameters({
  tessedit_pageseg_mode: 6, // Use number instead of string
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,?!()[]{}:;-/\n\t✓*✅x',
} as any);
    
    const { data }: RecognizeResult = await worker.recognize(imageBuffer);
    await worker.terminate();
    
    const cleanedText = cleanOCRText(data.text);
    const correctAnswerPattern = findCorrectAnswerByPatterns(data.text);
    
    console.log(`✅ Extracted ${cleanedText.length} characters`);
    if (correctAnswerPattern) {
      console.log(`🎯 Pattern detection found potential correct answer: ${correctAnswerPattern}`);
    }
    
    return {
      rawText: data.text,
      cleanedText,
      correctAnswerPattern,
      confidence: data.confidence
    };
    
  } catch (error) {
    await worker.terminate();
    console.error('❌ OCR Error:', error);
    return { 
      rawText: '', 
      cleanedText: '', 
      correctAnswerPattern: null, 
      confidence: 0 
    };
  }
}

// Enhanced prompt for both text and image PDFs
function createEnhancedPrompt(textData: TextData, pageNum: number | string = 'full_document', extractionMethod: string = 'direct'): string {
  let patternInfo = "No clear answer patterns detected.";
  let pageInfo = extractionMethod === 'direct' ? 'the entire document' : `page ${pageNum}`;
  
  if (textData.correctAnswerPattern) {
    patternInfo = `PATTERN DETECTION: Found marker for answer ${textData.correctAnswerPattern}. This is LIKELY the correct answer.`;
  }

  const prompt = `Extract ALL Multiple Choice Questions (MCQs) from this PDF ${pageInfo}.

CRITICAL ANALYSIS INSTRUCTIONS:
1. First, identify COMPLETE MCQs (question + typically 4 options A,B,C,D)
2. For EACH question, determine the correct answer using:
   - Pattern detection: ${patternInfo}
   - Look for options marked with ✓, *, ✅, (correct), [x], or similar markers
   - If pattern indicates answer ${textData.correctAnswerPattern}, prioritize that option
   - If no clear markers, use logical deduction

3. FORMAT REQUIREMENTS:
   - Return ONLY valid JSON array
   - Each question: { 
        "question": "full question text", 
        "options": ["A. option1", "B. option2", "C. option3", "D. option4"], 
        "correctAnswer": index (0-3),
        "confidence": "high/medium/low",
        "extractionMethod": "${extractionMethod}"
     }
   - correctAnswer index: 0=A, 1=B, 2=C, 3=D
   - Include ALL questions you can identify

TEXT CONTENT:
${textData.cleanedText.substring(0, 4000)}`;

  return prompt;
}

// Parse response
function parseAPIResponse(response: string | null, patternAnswer: string | null, extractionMethod: string = 'direct'): Question[] {
  if (!response) return [];
  
  try {
    let cleanResponse = response.replace(/```json|```/g, '').trim();
    const jsonMatch = cleanResponse.match(/\[\s*{[\s\S]*}\s*\]/);
    
    let questions: Question[] = [];
    if (jsonMatch) {
      questions = JSON.parse(jsonMatch[0]);
    } else {
      questions = JSON.parse(cleanResponse);
    }
    
    if (patternAnswer && questions.length > 0) {
      questions = questions.map(q => ({
        ...q,
        patternDetected: patternAnswer,
        confidence: q.confidence || 'high',
        extractionMethod: extractionMethod
      }));
    } else {
      questions = questions.map(q => ({
        ...q,
        extractionMethod: extractionMethod
      }));
    }
    
    return questions;
  } catch (error) {
    console.error('❌ Parse error:', (error as Error).message);
    console.log('Raw response sample:', response?.substring(0, 300));
    return [];
  }
}

// DeepSeek API call
async function sendToDeepSeek(prompt: string, identifier: string): Promise<string | null> {
  try {
    console.log(`📡 Sending ${identifier} to DeepSeek...`);
    
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });

    console.log(`✅ DeepSeek response received for ${identifier}`);
    return response.data.choices[0].message.content;
    
  } catch (error) {
    console.error(`❌ DeepSeek API error for ${identifier}:`, (error as any).response?.data || (error as Error).message);
    return null;
  }
}

// Process text-based PDF
async function processTextPDF(buffer: Buffer): Promise<Question[]> {
  try {
    console.log('\n=== 📝 PROCESSING TEXT-BASED PDF ===');
    const fullText = await extractTextFromPDF(buffer);
    
    if (!fullText || fullText.length < 100) {
      console.log('❌ Insufficient text extracted, falling back to image processing...');
      return await processImagePDF(buffer);
    }
    
    const correctAnswerPattern = findCorrectAnswerByPatterns(fullText);
    const textData: TextData = {
      rawText: fullText,
      cleanedText: fullText,
      correctAnswerPattern,
      confidence: 100
    };
    
    const prompt = createEnhancedPrompt(textData, 'full_document', 'direct');
    const apiResponse = await sendToDeepSeek(prompt, 'text PDF');
    
    if (apiResponse) {
      const questions = parseAPIResponse(apiResponse, correctAnswerPattern, 'direct');
      return questions.map(q => ({ ...q, page: 'full_document' }));
    } else {
      console.log('❌ API call failed, falling back to image processing...');
      return await processImagePDF(buffer);
    }
    
  } catch (error) {
    console.error('❌ Error processing text PDF:', error);
    console.log('🔄 Falling back to image processing...');
    return await processImagePDF(buffer);
  }
}

// Process image-based PDF
async function processImagePDF(buffer: Buffer): Promise<Question[]> {
  try {
    console.log('\n=== 🖼️ PROCESSING IMAGE-BASED PDF ===');
    const pageImages = await convertPDFToImages(buffer);
    const allQuestions: Question[] = [];
    
    for (const pageImage of pageImages) {
      console.log(`\n--- Processing Page ${pageImage.page} ---`);
      
      const textData = await extractTextWithOCR(pageImage.imageBuffer, pageImage.page);
      
      if (textData.cleanedText && textData.cleanedText.length > 50) {
        console.log(`✅ Text extraction successful: ${textData.cleanedText.length} chars`);
        
        const prompt = createEnhancedPrompt(textData, pageImage.page, 'ocr');
        const apiResponse = await sendToDeepSeek(prompt, `page ${pageImage.page}`);
        
        if (apiResponse) {
          const questions = parseAPIResponse(apiResponse, textData.correctAnswerPattern, 'ocr');
          const enhancedQuestions = questions.map(q => ({
            ...q,
            page: pageImage.page,
            extractionMethod: 'ocr'
          }));
          
          allQuestions.push(...enhancedQuestions);
          console.log(`✅ Page ${pageImage.page}: Extracted ${questions.length} questions`);
        }
      } else {
        console.log(`❌ Page ${pageImage.page}: Insufficient text extracted`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return allQuestions;
  } catch (error) {
    console.error('❌ Error processing image PDF:', error);
    throw error;
  }
}

// Universal PDF processing function
async function processUniversalPDF(buffer: Buffer): Promise<Question[]> {
  try {
    console.log('🚀 Starting universal PDF processing...');
    
    // First detect PDF type
    const pdfInfo = await detectPDFType(buffer);
    let questions: Question[] = [];
    
    if (pdfInfo.isTextBased) {
      console.log('🎯 Using text-based extraction method...');
      questions = await processTextPDF(buffer);
    } else {
      console.log('🎯 Using image-based extraction method...');
      questions = await processImagePDF(buffer);
    }
    
    // Save results summary
    if (questions && questions.length > 0) {
      const withPattern = questions.filter(q => q.patternDetected).length;
      const directExtraction = questions.filter(q => q.extractionMethod === 'direct').length;
      const ocrExtraction = questions.filter(q => q.extractionMethod === 'ocr').length;
      
      console.log(`\n✅ SUCCESS! Extracted ${questions.length} questions`);
      console.log(`📊 Summary: ${withPattern} questions with pattern detection`);
      console.log(`📊 Extraction methods: ${directExtraction} direct, ${ocrExtraction} OCR`);
    } else {
      console.log('❌ No questions were extracted');
    }
    
    return questions;
    
  } catch (error) {
    console.error('❌ Error processing PDF:', error);
    
    // Final fallback
    console.log('🔄 Attempting final fallback to image processing...');
    try {
      const questions = await processImagePDF(buffer);
      return questions;
    } catch (fallbackError) {
      console.error('❌ All processing methods failed:', fallbackError);
      return [];
    }
  }
}

// MAIN FIX: Updated processPDFWithPatternDetection to use universal processing
async function processPDFWithPatternDetection(buffer: Buffer): Promise<Question[]> {
  console.log('🔧 Starting enhanced PDF processing with type detection...');
  return await processUniversalPDF(buffer);
}

// API handler
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('pdf') as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No PDF file uploaded' }), { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('📥 PDF uploaded, starting processing...');
    const questions = await processPDFWithPatternDetection(buffer);
    
    return new Response(JSON.stringify({ 
      success: true,
      questions,
      count: questions.length
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Processing error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process PDF',
      details: (error as Error).message
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}