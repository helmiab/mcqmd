'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function Admin() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [message, setMessage] = useState<string>('');
  const [savedCount, setSavedCount] = useState<number>(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string>('');
  const [uploadedPdfFilename, setUploadedPdfFilename] = useState<string>('');

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

  if (!session) {
    return (
      <div className="admin-container">
        <div className="auth-required">
          <div className="auth-card">
            <h2>Authentication Required</h2>
            <p>Please log in to access the admin dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  const uploadPdfToStorage = async (file: File): Promise<{url: string, filename: string}> => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Unauthorized - Please log in again');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, file, { 
          upsert: false,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('pdfs')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        return {
          url: urlData.publicUrl,
          filename: fileName
        };
      } else {
        throw new Error('Failed to generate public URL');
      }

    } catch (error) {
      throw new Error(`PDF upload failed: ${(error as Error).message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setLoading(true);
    setMessage('');
    setResults([]);
    setSavedCount(0);
    setUploadedPdfUrl('');
    setUploadedPdfFilename('');
    
    try {
      setMessage('📤 Uploading PDF to storage...');
      const { url: pdfUrl, filename: pdfFilename } = await uploadPdfToStorage(file);
      setUploadedPdfUrl(pdfUrl);
      setUploadedPdfFilename(pdfFilename);
      
      setMessage('🔍 Processing PDF and extracting questions...');
      const formData = new FormData();
      formData.append('pdf', file);
      
      const res = await fetch('/api/admin', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('Failed to process PDF');
      }
      
      const data = await res.json();
      
      const questionsWithPdfInfo = data.questions.map((question: any) => ({
        ...question,
        pdfUrl: pdfUrl,
        pdfFilename: pdfFilename
      }));
      
      setResults(questionsWithPdfInfo);
      setMessage(`✅ Successfully processed ${data.questions?.length || 0} questions from PDF`);
      
    } catch (error) {
      console.error('Error:', error);
      setMessage(`❌ Error: ${(error as Error).message}`);
    }
    setLoading(false);
  };

  const handleSaveToDatabase = async () => {
    if (!results.length) return;
    
    setSaveLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/save-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          questions: results,
          pdfUrl: uploadedPdfUrl,
          pdfFilename: uploadedPdfFilename
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSavedCount(data.count);
        setMessage(`✅ Successfully saved ${data.count} questions to database! Linked to PDF: ${uploadedPdfFilename}`);
        setResults([]);
        setUploadedPdfUrl('');
        setUploadedPdfFilename('');
      } else {
        setMessage(`❌ Error saving to database: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving questions:', error);
      setMessage('❌ Error saving questions to database');
    }
    setSaveLoading(false);
  };
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
  return (
    <div className="admin-container">
      {/* Header */}
<div className="admin-header">
  <div className="header-content">
    <h1 className="header-title">
      <span className="header-icon">📊</span>
      PDF MCQ Extractor
    </h1>
    <div className="header-actions">
      <button
        onClick={() => window.location.href = '/reviewer'}
        className="header-button reviewer-button"
      >
        <span className="button-icon">🔍</span>
        Reviewer Panel
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
        <span>Admin</span>
      </div>
    </div>
  </div>
</div>

      {/* Main Content */}
      <div className="admin-content">
        {/* Upload Card */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">📤</span>
              Upload PDF Document
            </h2>
            <div className="card-subtitle">Upload a PDF file to extract multiple choice questions</div>
          </div>
          
          <form onSubmit={handleSubmit} className="upload-form">
            <div className="file-upload-area">
              <div className="upload-placeholder">
                <div className="upload-icon">📄</div>
                <div className="upload-text">
                  <span className="upload-title">Choose PDF file</span>
                  <span className="upload-subtitle">or drag and drop here</span>
                </div>
              </div>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="file-input"
              />
              {file && (
                <div className="file-selected">
                  <span className="file-name">📎 {file.name}</span>
                  <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !file}
              className={`submit-button ${loading ? 'loading' : ''} ${!file ? 'disabled' : ''}`}
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Processing PDF...
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  Upload & Process PDF
                </>
              )}
            </button>
          </form>
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`status-message ${
            message.includes('✅') ? 'success' : 
            message.includes('❌') ? 'error' : 'info'
          }`}>
            <div className="status-content">
              <span className="status-icon">
                {message.includes('✅') ? '✅' : 
                 message.includes('❌') ? '❌' : 
                 message.includes('📤') ? '📤' : '🔍'}
              </span>
              <span className="status-text">{message}</span>
            </div>
          </div>
        )}

        {/* PDF Info Card */}
        {uploadedPdfUrl && (
          <div className="dashboard-card">
            <div className="card-header">
              <h3 className="card-title">
                <span className="card-icon">📋</span>
                PDF Information
              </h3>
            </div>
            <div className="pdf-info-grid">
              <div className="info-item">
                <label>Filename</label>
                <span className="info-value">{uploadedPdfFilename}</span>
              </div>
              <div className="info-item">
                <label>PDF URL</label>
                <a href={uploadedPdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-link">
                  {uploadedPdfUrl}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="dashboard-card loading-card">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <div className="loading-text">
                <h4>Processing PDF Document</h4>
                <p>This may take a while for large PDFs. Please be patient.</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="dashboard-card results-card">
            <div className="card-header">
              <div className="header-main">
                <h2 className="card-title">
                  <span className="card-icon">📝</span>
                  Extracted Questions
                  <span className="results-badge">{results.length}</span>
                </h2>
                <div className="header-actions">
                  <button 
                    onClick={handleSaveToDatabase}
                    disabled={saveLoading}
                    className={`save-button ${saveLoading ? 'loading' : ''}`}
                  >
                    {saveLoading ? (
                      <>
                        <span className="button-spinner"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="button-icon">💾</span>
                        Save to Database
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="results-container">
              <div className="json-viewer">
                <pre className="json-content">
                  {JSON.stringify(results, null, 2)}
                </pre>
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
          max-width: 1200px;
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
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
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

        .upload-form {
          padding: 2rem;
        }

        .file-upload-area {
          position: relative;
          border: 2px dashed #dee2e6;
          border-radius: 8px;
          padding: 3rem 2rem;
          text-align: center;
          margin-bottom: 1.5rem;
          transition: all 0.2s ease;
        }

        .file-upload-area:hover {
          border-color: #0070f3;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: #6c757d;
        }

        .upload-icon {
          font-size: 3rem;
          opacity: 0.7;
        }

        .upload-title {
          font-weight: 600;
          font-size: 1.125rem;
          display: block;
        }

        .upload-subtitle {
          font-size: 0.875rem;
          display: block;
          margin-top: 0.25rem;
        }

        .file-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .file-selected {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 500;
          color: #198754;
        }

        .file-name {
          font-weight: 600;
        }

        .file-size {
          font-size: 0.875rem;
          color: #6c757d;
        }

        .submit-button {
          width: 100%;
          padding: 1rem 2rem;
          background: #0070f3;
          color: white;
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

        .submit-button:hover:not(.disabled):not(.loading) {
          background: #0056cc;
          transform: translateY(-1px);
        }

        .submit-button.disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .submit-button.loading {
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

        .pdf-info-grid {
          padding: 1.5rem 2rem;
          display: grid;
          gap: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-item label {
          font-weight: 600;
          color: #495057;
          font-size: 0.875rem;
        }

        .info-value {
          color: #1a1d23;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
        }

        .pdf-link {
          color: #0070f3;
          text-decoration: none;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
          word-break: break-all;
        }

        .pdf-link:hover {
          text-decoration: underline;
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

        .results-card {
          margin-top: 1rem;
        }

        .header-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .results-badge {
          background: #0070f3;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-left: 0.75rem;
        }

        .save-button {
          padding: 0.75rem 1.5rem;
          background: #198754;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .save-button:hover:not(.loading) {
          background: #157347;
          transform: translateY(-1px);
        }

        .save-button.loading {
          background: #495057;
          cursor: not-allowed;
        }

        .results-container {
          padding: 0 2rem 2rem;
        }

        .json-viewer {
          background: #f8f9fa;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          overflow: hidden;
        }

        .json-content {
          margin: 0;
          padding: 1.5rem;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #1a1d23;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 500px;
          overflow: auto;
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

        @media (max-width: 768px) {
          .admin-content {
            padding: 1rem;
          }

          .header-content {
            padding: 1rem;
          }

          .header-main {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .upload-form {
            padding: 1rem;
          }

          .file-upload-area {
            padding: 2rem 1rem;
          }

          .card-header {
            padding: 1rem 1.5rem;
          }

          .results-container {
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
  white-space: nowrap;
}

.header-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.reviewer-button {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.reviewer-button:hover {
  background: #218838;
  border-color: #218838;
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
  flex-shrink: 0;
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
  white-space: nowrap;
  flex-shrink: 0;
}

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
  white-space: nowrap;
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
    display: none;
  }
  
  .header-button .button-icon {
    margin-right: 0;
  }
  
  .user-badge span:last-child {
    display: none;
  }
  
  .header-title {
    font-size: 1.25rem;
  }
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