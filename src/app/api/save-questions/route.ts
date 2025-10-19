import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;


const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  confidence: string;
  page?: number | string;
  extractionMethod?: string;
  patternDetected?: string;
  pdfUrl?: string;
  pdfFilename?: string;
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

    // Transform questions to match database schema
    const questionsToInsert = questions.map((q: Question) => {
      // Handle page field - convert 'full_document' to NULL or a specific value
      let pageValue = q.page;
      
      if (pageValue === 'full_document' || isNaN(Number(pageValue))) {
        pageValue = null;
      } else {
        pageValue = Number(pageValue);
      }

      return {
        question_text: q.question,
        options: q.options,
        correct_answer: String.fromCharCode(65 + q.correctAnswer),
        confidence: q.confidence,
        extraction_method: q.extractionMethod,
        pattern_detected: q.patternDetected,
        page: pageValue,
        pdf_url: q.pdfUrl || pdfUrl, // Use question-specific PDF URL or general one
        pdf_filename: q.pdfFilename || pdfFilename,
        category: 'default',
        chapter: 'default',
        year: 2024,
        review_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    const { data, error } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select();

    if (error) {
      console.error('❌ Error saving questions to Supabase:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully saved ${data?.length || 0} questions to Supabase`);
    
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