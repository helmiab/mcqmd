'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string[];
  confidence: string;
  extraction_method: string;
  pattern_detected?: string;
  page?: number;
  review_count: number;
  pdf_url: string;
  pdf_filename: string;
}

interface PdfInfo {
  url: string;
  filename: string;
  unreviewed_count: number;
  total_questions: number;
}

export default function Reviewer() {
  const [session, setSession] = useState<any>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentPdf, setCurrentPdf] = useState<PdfInfo | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [stats, setStats] = useState({
    confirmed: 0,
    skipped: 0,
    totalReviewed: 0
  });
    const currentQuestion = currentQuestions[currentQuestionIndex];
      const arraysEqual = (a: string[], b: string[]): boolean => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  };

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

useEffect(() => {
  if (currentQuestion) {
    console.log('Raw correct_answer:', currentQuestion.correct_answer);
    
    let cleanedAnswers: string[] = [];
    
    if (Array.isArray(currentQuestion.correct_answer)) {
      // If it's already an array, clean it
      cleanedAnswers = currentQuestion.correct_answer
        .filter(answer => 
          answer && 
          typeof answer === 'string' && 
          answer.trim() !== '' && 
          answer.trim() !== ','
        )
        .map(answer => answer.trim());
    } else if (typeof currentQuestion.correct_answer === 'string') {
      // If it's a string, split by commas and clean
      cleanedAnswers = currentQuestion.correct_answer
        .split(',')
        .filter(answer => 
          answer && 
          answer.trim() !== '' && 
          answer.trim() !== ','
        )
        .map(answer => answer.trim());
    }
    
    console.log('Cleaned answers:', cleanedAnswers);
    setSelectedAnswers(cleanedAnswers);
  }
}, [currentQuestion]);

  const startReviewing = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/review');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch review data');
      }

      if (!data.pdf) {
        setMessage('🎉 No more PDFs with unreviewed questions found! All questions have been reviewed.');
        return;
      }

      setCurrentPdf(data.pdf);
      setCurrentQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setIsReviewing(true);
      setMessage(`Loaded PDF with ${data.questions.length} questions to review`);

    } catch (error) {
      console.error('Error starting review:', error);
      setMessage(`❌ Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

const handleQuestionAction = async (action: 'confirm' | 'skip') => {
  if (!currentQuestions.length) return;

  const currentQuestion = currentQuestions[currentQuestionIndex];
  setLoading(true);

  try {
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionId: currentQuestion.id,
        action: action,
        correctAnswers: action === 'confirm' ? selectedAnswers : undefined
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to update question');
    }

    // Update stats
    setStats(prev => ({
      ...prev,
      [action === 'confirm' ? 'confirmed' : 'skipped']: prev[action === 'confirm' ? 'confirmed' : 'skipped'] + 1,
      totalReviewed: prev.totalReviewed + 1
    }));

    // RESET SELECTED ANSWERS HERE - Add this line
    setSelectedAnswers([]);

    // Move to next question or finish
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setMessage(`✅ Question ${action === 'confirm' ? 'confirmed' : 'skipped'}. ${currentQuestions.length - currentQuestionIndex - 1} questions remaining.`);
    } else {
      setMessage(`🎉 Finished reviewing all questions in this PDF! ${action === 'confirm' ? 'Confirmed' : 'Skipped'} the last question.`);
      setIsReviewing(false);
      setCurrentPdf(null);
      setCurrentQuestions([]);
    }

  } catch (error) {
    console.error('Error updating question:', error);
    setMessage(`❌ Error: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

  const stopReviewing = () => {
    setIsReviewing(false);
    setCurrentPdf(null);
    setCurrentQuestions([]);
    setCurrentQuestionIndex(0);
    setMessage('Review session stopped');
  };

  if (!session) {
    return (
      <div className="admin-container">
        <div className="auth-required">
          <div className="auth-card">
            <h2>Authentication Required</h2>
            <p>Please log in to access the reviewer dashboard</p>
          </div>
        </div>
      </div>
    );
  }


  const handleLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Redirect to login page or home page after logout
    window.location.href = '/';
  } catch (error) {
    console.error('Error logging out:', error);
    setMessage('❌ Error logging out');
  }
};
const handleOptionSelect = (optionLetter: string) => {
  if (!currentQuestion) return;
  
  console.log('Selected option letter:', optionLetter);
  console.log('Current selectedAnswers before:', selectedAnswers);
  
  // For review mode, allow toggling any option
  setSelectedAnswers(prev => {
    if (prev.includes(optionLetter)) {
      const newAnswers = prev.filter(letter => letter !== optionLetter);
      console.log('After removing:', newAnswers);
      return newAnswers;
    } else {
      const newAnswers = [...prev, optionLetter];
      console.log('After adding:', newAnswers);
      return newAnswers;
    }
  });
};


  return (
    <div className="admin-container">
<div className="admin-header">
  <div className="header-content">
    <h1 className="header-title">
      <span className="header-icon">🔍</span>
      Question Reviewer
    </h1>
    <div className="header-actions">
      <button
        onClick={() => window.location.href = '/upload'}
        className="header-button admin-button"
      >
        <span className="button-icon">⚙️</span>
        Upload Panel
      </button>
      <button
        onClick={handleLogout}
        className="header-button logout-button"
      >
        <span className="button-icon">🚪</span>
        Logout
      </button>
      <div className="user-badge">
        <span className="user-avatar">👤</span>
        <span>Reviewer</span>
      </div>
    </div>
  </div>
</div>

      {/* Main Content */}
      <div className="admin-content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon confirmed">✅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.confirmed}</div>
              <div className="stat-label">Confirmed</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon skipped">⏭️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.skipped}</div>
              <div className="stat-label">Skipped</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon total">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalReviewed}</div>
              <div className="stat-label">Total Reviewed</div>
            </div>
          </div>
        </div>

        {/* Start Review Section */}
        {!isReviewing && (
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon">🎯</span>
                Start Review Session
              </h2>
              <div className="card-subtitle">
                Review and validate extracted questions from PDF documents
              </div>
            </div>
            <div className="review-start-content">
              <div className="review-placeholder">
                <div className="review-icon">📝</div>
                <div className="review-text">
                  <h3>Ready to Review Questions</h3>
                  <p>Start a review session to validate extracted questions from PDF documents</p>
                </div>
              </div>
              <button
                onClick={startReviewing}
                disabled={loading}
                className={`start-review-button ${loading ? 'loading' : ''}`}
              >
                {loading ? (
                  <>
                    <span className="button-spinner"></span>
                    Loading Questions...
                  </>
                ) : (
                  <>
                    <span className="button-icon">🎯</span>
                    Start Review Session
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        {message && (
          <div className={`status-message ${
            message.includes('❌') ? 'error' : 
            message.includes('🎉') ? 'success' : 'info'
          }`}>
            <div className="status-content">
              <span className="status-icon">
                {message.includes('❌') ? '❌' : 
                 message.includes('🎉') ? '🎉' : 'ℹ️'}
              </span>
              <span className="status-text">{message}</span>
            </div>
          </div>
        )}

        {/* Review Interface */}
        {isReviewing && currentPdf && currentQuestion && (
          <div className="review-interface">
            {/* PDF Viewer Card */}
            <div className="dashboard-card pdf-viewer-card">
              <div className="card-header">
                <h3 className="card-title">
                  <span className="card-icon">📄</span>
                  PDF Document
                </h3>
                <div className="pdf-meta">
                  <span className="pdf-filename">{currentPdf.filename.split('/').pop()}</span>
                  <span className="pdf-stats">
                    {currentQuestions.length} questions • {currentPdf.unreviewed_count} need review
                  </span>
                </div>
              </div>
              <div className="pdf-container">
                <iframe
                  src={currentPdf.url}
                  className="pdf-iframe"
                  title="PDF Viewer"
                />
              </div>
            </div>

            {/* Question Review Card */}
            <div className="dashboard-card question-card">
              <div className="card-header">
                <div className="question-header">
                  <h3 className="card-title">
                    <span className="card-icon">❓</span>
                    Question {currentQuestionIndex + 1} of {currentQuestions.length}
                  </h3>
                  <button
                    onClick={stopReviewing}
                    className="stop-review-button"
                  >
                    <span className="button-icon">⏹️</span>
                    Stop Review
                  </button>
                </div>
              </div>

              <div className="question-content">
                {/* Question Metadata */}
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <label>Confidence</label>
                    <span className="metadata-value confidence">{currentQuestion.confidence}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Extraction Method</label>
                    <span className="metadata-value">{currentQuestion.extraction_method}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Page</label>
                    <span className="metadata-value">{currentQuestion.page || 'N/A'}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Review Count</label>
                    <span className="metadata-value reviews">{currentQuestion.review_count}/2</span>
                  </div>
                  {currentQuestion.pattern_detected && (
                    <div className="metadata-item full-width">
                      <label>Pattern Detected</label>
                      <span className="metadata-value pattern">{currentQuestion.pattern_detected}</span>
                    </div>
                  )}
                </div>

                {/* Question Text */}
                <div className="question-text-section">
                  <h4>Question Text</h4>
                  <div className="question-text">
                    {currentQuestion.question_text}
                  </div>
                </div>

                {/* Options */}
       {/* Options */}
<div className="options-section">
  <h4>Multiple Choice Options</h4>
  <div className="options-list">
    {currentQuestion.options.map((option, index) => {
      const optionLetter = option.split('.')[0].trim();
      const isSelected = selectedAnswers.includes(optionLetter);
      const isCorrect = Array.isArray(currentQuestion.correct_answer) 
        ? currentQuestion.correct_answer.includes(optionLetter)
        : currentQuestion.correct_answer === optionLetter;
      
      return (
        <div
          key={index}
          className={`option-item ${isSelected ? 'selected' : ''} ${
            isCorrect ? 'correct' : ''
          }`}
          onClick={() => handleOptionSelect(optionLetter)}
        >
          <div className="option-header">
            <div className="option-selector">
              {isSelected ? '✓' : ''}
            </div>
            <div className="option-text">{option}</div>
          </div>
          {isCorrect && (
            <div className="correct-badge">Expected Answer</div>
          )}
        </div>
      );
    })}
  </div>
</div>

                {/* Action Buttons */}
             {/* Action Buttons */}
{/* Action Buttons */}
<div className="action-buttons">
  <button
    onClick={() => handleQuestionAction('skip')}
    disabled={loading}
    className={`action-button skip-button ${loading ? 'loading' : ''}`}
  >
    {loading ? (
      <span className="button-spinner"></span>
    ) : (
      <span className="button-icon">⏭️</span>
    )}
    Skip Question
  </button>
  <button
    onClick={() => handleQuestionAction('confirm')}
    disabled={loading || selectedAnswers.length === 0}
    className={`action-button confirm-button ${loading ? 'loading' : ''} ${
      selectedAnswers.length === 0 ? 'disabled' : ''
    }`}
  >
    {loading ? (
      <span className="button-spinner"></span>
    ) : (
      <span className="button-icon">✅</span>
    )}
    Confirm {selectedAnswers.length} Answer{selectedAnswers.length !== 1 ? 's' : ''}
  </button>
</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !isReviewing && (
          <div className="dashboard-card loading-card">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <div className="loading-text">
                <h4>Loading Review Session</h4>
                <p>Preparing questions for review...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .admin-container {
          min-height: 100vh;
          background: #f5f7fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .admin-header {
          background: white;
          border-bottom: 1px solid #e1e5e9;
          padding: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a1d23;
          margin: 0;
        }

        .header-icon {
          font-size: 1.75rem;
        }

        .user-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          font-weight: 500;
          color: #495057;
        }

        .user-avatar {
          font-size: 1.25rem;
        }

        .admin-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e1e5e9;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .stat-icon.confirmed {
          background: #d4edda;
          color: #155724;
        }

        .stat-icon.skipped {
          background: #e2e3e5;
          color: #383d41;
        }

        .stat-icon.total {
          background: #cce7ff;
          color: #004085;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1d23;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6c757d;
          margin-top: 0.25rem;
        }

        .dashboard-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e1e5e9;
          overflow: hidden;
        }

        .card-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #f1f3f4;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a1d23;
          margin: 0;
        }

        .card-icon {
          font-size: 1.5rem;
        }

        .card-subtitle {
          color: #6c757d;
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .review-start-content {
          padding: 3rem 2rem;
          text-align: center;
        }

        .review-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          color: #6c757d;
        }

        .review-icon {
          font-size: 4rem;
          opacity: 0.7;
        }

        .review-text h3 {
          margin: 0 0 0.5rem 0;
          color: #1a1d23;
          font-size: 1.5rem;
        }

        .review-text p {
          margin: 0;
          font-size: 1rem;
        }

        .start-review-button {
          padding: 1rem 2rem;
          background: #0070f3;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.125rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .start-review-button:hover:not(.loading) {
          background: #0056cc;
          transform: translateY(-1px);
        }

        .start-review-button.loading {
          background: #495057;
          cursor: not-allowed;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .status-message {
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border-left: 4px solid;
        }

        .status-message.success {
          background: #d4edda;
          border-left-color: #198754;
          color: #0f5132;
        }

        .status-message.error {
          background: #f8d7da;
          border-left-color: #dc3545;
          color: #721c24;
        }

        .status-message.info {
          background: #cce7ff;
          border-left-color: #0070f3;
          color: #004085;
        }

        .status-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .status-icon {
          font-size: 1.25rem;
        }

        .review-interface {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          align-items: start;
        }

        .pdf-viewer-card {
          height: fit-content;
        }

        .pdf-meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 0.5rem;
        }

        .pdf-filename {
          font-weight: 600;
          color: #1a1d23;
        }

        .pdf-stats {
          font-size: 0.875rem;
          color: #6c757d;
        }

        .pdf-container {
          padding: 0 2rem 2rem;
        }

        .pdf-iframe {
          width: 100%;
          height: 600px;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
        }

        .question-card {
          height: fit-content;
        }

        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stop-review-button {
          padding: 0.5rem 1rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .stop-review-button:hover {
          background: #c82333;
          transform: translateY(-1px);
        }

        .question-content {
          padding: 0 2rem 2rem;
        }

        .metadata-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .metadata-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metadata-item.full-width {
          grid-column: 1 / -1;
        }

        .metadata-item label {
          font-weight: 600;
          color: #495057;
          font-size: 0.875rem;
        }

        .metadata-value {
          color: #1a1d23;
          font-weight: 500;
        }

        .metadata-value.confidence {
          color: #198754;
          font-weight: 600;
        }

        .metadata-value.reviews {
          color: #0070f3;
          font-weight: 600;
        }

        .metadata-value.pattern {
          color: #6f42c1;
          font-weight: 600;
        }

        .question-text-section {
          margin-bottom: 2rem;
        }

        .question-text-section h4 {
          margin: 0 0 1rem 0;
          color: #1a1d23;
          font-size: 1.125rem;
        }

        .question-text {
          padding: 1.5rem;
          background: #e7f3ff;
          border-radius: 8px;
          font-size: 1.125rem;
          line-height: 1.6;
          color: #004085;
          font-weight: 500;
        }

        .options-section {
          margin-bottom: 2rem;
        }

        .options-section h4 {
          margin: 0 0 1rem 0;
          color: #1a1d23;
          font-size: 1.125rem;
        }

        .options-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .option-item {
          padding: 1rem 1.25rem;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          background: white;
          transition: all 0.2s ease;
        }

        .option-item.correct {
          border-color: #198754;
          background: #d4edda;
        }

        .option-text {
          font-size: 1rem;
          line-height: 1.5;
          color: #1a1d23;
        }

        .correct-badge {
          margin-top: 0.5rem;
          padding: 0.25rem 0.75rem;
          background: #198754;
          color: white;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          display: inline-block;
        }

        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .action-button {
          padding: 1rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .action-button:hover:not(.loading) {
          transform: translateY(-1px);
        }

        .action-button.loading {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .skip-button {
          background: #6c757d;
          color: white;
        }

        .skip-button:hover:not(.loading) {
          background: #5a6268;
        }

        .confirm-button {
          background: #198754;
          color: white;
        }

        .confirm-button:hover:not(.loading) {
          background: #157347;
        }

        .loading-card {
          padding: 2rem;
        }

        .loading-content {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f1f3f4;
          border-top: 3px solid #0070f3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-text h4 {
          margin: 0 0 0.5rem 0;
          color: #1a1d23;
        }

        .loading-text p {
          margin: 0;
          color: #6c757d;
          font-size: 0.875rem;
        }

        .auth-required {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f5f7fa;
        }

        .auth-card {
          background: white;
          padding: 3rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
          width: 100%;
        }

        .auth-card h2 {
          margin: 0 0 1rem 0;
          color: #1a1d23;
        }

        .auth-card p {
          color: #6c757d;
          margin: 0;
        }

        @media (max-width: 1024px) {
          .review-interface {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .admin-content {
            padding: 1rem;
          }

          .header-content {
            padding: 1rem;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .metadata-grid {
            grid-template-columns: 1fr;
          }

          .action-buttons {
            grid-template-columns: 1fr;
          }

          .question-header {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .card-header {
            padding: 1rem 1.5rem;
          }

          .question-content {
            padding: 0 1.5rem 1.5rem;
          }

          .pdf-container {
            padding: 0 1.5rem 1.5rem;
          }
        }
          .header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-button {
  padding: 0.5rem 1rem;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  color: #495057;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  text-decoration: none;
  font-size: 0.875rem;
  white-space: nowrap; /* Prevents text wrapping */
}

.header-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.admin-button {
  background: #0070f3;
  color: white;
  border-color: #0070f3;
}

.admin-button:hover {
  background: #0056cc;
  border-color: #0056cc;
}

.logout-button {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.logout-button:hover {
  background: #c82333;
  border-color: #c82333;
}

.button-icon {
  font-size: 1rem;
  flex-shrink: 0; /* Prevents icons from shrinking */
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  font-weight: 500;
  color: #495057;
  white-space: nowrap; /* Prevents text wrapping */
  flex-shrink: 0; /* Prevents badge from shrinking */
}

/* Ensure header content has proper spacing */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1d23;
  margin: 0;
  white-space: nowrap; /* Prevents title wrapping */
}

/* Responsive design for smaller screens */
@media (max-width: 768px) {
  .header-actions {
    gap: 0.5rem;
  }
  
  .header-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
  
  .header-button span:not(.button-icon) {
    display: none; /* Hide button text on very small screens */
  }
  
  .header-button .button-icon {
    margin-right: 0;
  }
  
  .user-badge span:last-child {
    display: none; /* Hide "Reviewer" text on small screens */
  }
  
  .header-title {
    font-size: 1.25rem;
  }
}
  .option-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-item:hover {
  background: #f8f9fa;
}

.option-item.selected {
  border-color: #0070f3;
  background: #e7f3ff;
}

.option-item.correct {
  border-color: #198754;
}

.option-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.option-selector {
  width: 20px;
  height: 20px;
  border: 2px solid #6c757d;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.option-item.selected .option-selector {
  background: #0070f3;
  border-color: #0070f3;
  color: white;
}

.confirm-button.disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.confirm-button.disabled:hover {
  background: #6c757d;
  transform: none;
}

@media (max-width: 480px) {
  .header-content {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .header-title {
    font-size: 1.1rem;
  }
  
  .header-actions {
    order: 2;
    width: 100%;
    justify-content: flex-end;
  }
}
      `}</style>
    </div>
  );
}