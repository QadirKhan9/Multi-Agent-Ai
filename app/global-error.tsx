"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-gray-900 border border-gray-800 rounded-2xl">
          <h2 className="text-xl font-bold text-white">Critical Application Error</h2>
          <p className="text-sm text-gray-400">
            A system error occurred. Please refresh the page to restore normal operation.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Refresh App
          </button>
        </div>
      </body>
    </html>
  );
}
