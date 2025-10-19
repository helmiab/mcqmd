export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6">
      <div className="bg-white text-gray-900 rounded-xl shadow-lg p-10 max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to PDF MCQ Extractor</h1>
        <p className="text-lg">
          Go to{' '}
          <a
            href="/admin"
            className="text-indigo-600 font-semibold hover:text-indigo-800 underline"
          >
            /admin
          </a>{' '}
          to process PDFs.
        </p>
      </div>
    </div>
  );
}
