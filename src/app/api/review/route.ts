import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    // Get a PDF that has questions with less than 2 reviews
    const { data: pdfs, error: pdfError } = await supabase
      .rpc('get_pdfs_with_unreviewed_questions');

    if (pdfError) {
      console.error('Error getting PDFs:', pdfError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pdfs || pdfs.length === 0) {
      return NextResponse.json({ 
        message: 'No PDFs with unreviewed questions found',
        pdf: null,
        questions: []
      });
    }

    // Select a random PDF from the list
    const randomPdf = pdfs[Math.floor(Math.random() * pdfs.length)];

    // Get questions for this PDF that have less than 2 reviews
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('pdf_url', randomPdf.pdf_url)
      .lt('review_count', 2)
      .order('page', { nullsFirst: true })
      .order('id');

    if (questionsError) {
      console.error('Error getting questions:', questionsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      pdf: {
        url: randomPdf.pdf_url,
        filename: randomPdf.pdf_filename,
        unreviewed_count: randomPdf.unreviewed_count,
        total_questions: randomPdf.total_questions
      },
      questions: questions || []
    });

  } catch (error) {
    console.error('Error in review API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, action } = body; // action: 'confirm' or 'skip'

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    if (action === 'confirm') {
      // First, get the current review_count
      const { data: currentQuestion, error: fetchError } = await supabase
        .from('questions')
        .select('review_count')
        .eq('id', questionId)
        .single();

      if (fetchError) {
        console.error('Error fetching question:', fetchError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // Increment review_count by 1
      const { data, error } = await supabase
        .from('questions')
        .update({ 
          review_count: (currentQuestion.review_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)
        .select();

      if (error) {
        console.error('Error updating question:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Question confirmed successfully',
        question: data?.[0]
      });
    } else if (action === 'skip') {
      // Just return success without updating
      return NextResponse.json({ 
        success: true, 
        message: 'Question skipped'
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in review update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}