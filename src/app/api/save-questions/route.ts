import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

interface Question {
  question: string;
  options: string[];
  correctAnswer: string[]; // This is string[]
  confidence: string;
  page?: number | string;
  extractionMethod?: string;
  patternDetected?: string;
  pdfUrl?: string;
  pdfFilename?: string;
}

// ENHANCED TEXT CLEANING FUNCTION
function cleanTextForDatabase(text: any): string {
  if (text === null || text === undefined) return '';
  
  // Convert to string and remove ALL problematic characters
  const textStr = String(text)
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/\\u0000/g, '') // Remove escaped null characters
    .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove other non-printable characters
    .replace(/\0/g, '') // Remove any remaining null bytes
    .trim();
  
  return textStr;
}

// DEBUGGING FUNCTION TO IDENTIFY PROBLEMATIC FIELDS
function debugCleanText(text: any, fieldName: string): string {
  const original = String(text);
  const cleaned = cleanTextForDatabase(text);
  
  // Check if cleaning changed anything
  if (original !== cleaned) {
    console.log(`🔍 Cleaned ${fieldName}: "${original.substring(0, 50)}" -> "${cleaned.substring(0, 50)}"`);
  }
  
  // Check for remaining null characters
  if (cleaned.includes('\u0000') || cleaned.includes('\\u0000')) {
    console.error(`❌ STILL HAS NULL CHARS in ${fieldName}:`, cleaned);
  }
  
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { 
          error: 'Database not configured. Please check your environment variables.',
          details: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { questions, pdfUrl, pdfFilename } = body;

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Questions array is required' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving ${questions.length} questions to Supabase...`);

    // ADD DEBUG LOGGING TO SEE THE ACTUAL DATA
    console.log('📥 Sample of received data:');
    questions.slice(0, 2).forEach((q: Question, index: number) => {
      console.log(`Question ${index + 1}:`, {
        question: q.question?.substring(0, 100),
        correctAnswer: q.correctAnswer,
        correctAnswerType: typeof q.correctAnswer,
        isArray: Array.isArray(q.correctAnswer),
        options: q.options
      });
    });

    // Transform questions to match database schema WITH DEBUGGING
    const questionsToInsert = questions.map((q: Question, index: number) => {
      // Handle page field - convert 'full_document' to NULL or a specific value
      let pageValue: string | number | null | undefined = q.page;

      if (pageValue === 'full_document' || (pageValue && isNaN(Number(pageValue)))) {
        pageValue = null;
      } else if (pageValue) {
        pageValue = Number(pageValue);
      }

      console.log(`🧹 Cleaning question ${index + 1}: "${q.question.substring(0, 50)}..."`);

      // FIXED: Handle correct_answer properly based on actual data format
const  answers = q.correctAnswer.map(mapToLetter);

      const cleanedQuestion = {
        question_text: debugCleanText(q.question, `question ${index + 1} text`),
        options: q.options.map((opt, optIndex) => 
          debugCleanText(opt, `question ${index + 1} option ${optIndex}`)
        ),
        correct_answer: debugCleanText(answers, `question ${index + 1} correct_answer`), // This should now be proper string[]
        confidence: debugCleanText(q.confidence, `question ${index + 1} confidence`),
        extraction_method: debugCleanText(q.extractionMethod, `question ${index + 1} extraction_method`),
        pattern_detected: debugCleanText(q.patternDetected, `question ${index + 1} pattern_detected`),
        page: pageValue,
        pdf_url: debugCleanText(q.pdfUrl || pdfUrl, `question ${index + 1} pdf_url`),
        pdf_filename: debugCleanText(q.pdfFilename || pdfFilename, `question ${index + 1} pdf_filename`),
        category: 'default',
        chapter: 'default',
        year: 2024,
        review_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log(`✅ Final correct_answer for question ${index + 1}:`, cleanedQuestion.correct_answer);

      return cleanedQuestion;
    });

    console.log('✅ All questions cleaned, inserting into database...');

    const { data, error } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select();

    if (error) {
      console.error('❌ Error saving questions to Supabase:', error);
      
      // Try to identify which question caused the issue
      if (questionsToInsert.length > 0) {
        console.log('🔍 First question being inserted:', JSON.stringify(questionsToInsert[0], null, 2));
      }
      
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully saved ${data?.length || 0} questions to Supabase`);
    
    // Log sample of saved data to verify correct answers
    if (data && data.length > 0) {
      console.log('📊 Sample saved questions:');
      data.slice(0, 3).forEach((question, index) => {
        console.log(`Question ${index + 1}:`, {
          id: question.id,
          question_text: question.question_text?.substring(0, 50),
          correct_answer: question.correct_answer,
          options: question.options
        });
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully saved ${data?.length || 0} questions to database`,
      count: data?.length || 0,
      questions: data
    });

  } catch (error) {
    console.error('❌ Error in save-questions API:', error);
    return NextResponse.json(
      { error: 'Failed to save questions' },
      { status: 500 }
    );
  }
}
function mapToLetter(num) {
  if (num < 0 || num > 25) {
    return 'Invalid';
  }
  return String.fromCharCode(65 + num); // 65 is ASCII for 'A'
}