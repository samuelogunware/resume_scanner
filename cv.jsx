import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

// --- Helper Components ---

const Icon = ({ path, className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const SparkleIcon = () => <Icon path="M9.813 15.904L9 18l-1.813-2.096a4.5 4.5 0 01-1.687-3.053V8.25a4.5 4.5 0 014.5-4.5h2.25a4.5 4.5 0 014.5 4.5v2.596a4.5 4.5 0 01-1.687 3.053L15 18l-.813-2.096a4.5 4.5 0 00-4.374 0z" className="w-5 h-5 inline-block mr-1" />;
const UploadIcon = () => <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />;
const FileIcon = () => <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />;
const LoadingSpinner = ({ text = "Analyzing..."}) => (
    <div className="flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        <p className="mt-2 text-slate-600">{text}</p>
    </div>
);

// --- Main App Component ---

export default function App() {
    const [jobDescription, setJobDescription] = useState('');
    const [resumes, setResumes] = useState([]);
    const [analysisResults, setAnalysisResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [error, setError] = useState(null);
    const [isPdfJsReady, setIsPdfJsReady] = useState(false);

    // State for the new email modal
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailContent, setEmailContent] = useState('');
    const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

    // Effect to dynamically load the pdf.js script from a reliable CDN
    useEffect(() => {
        const PDF_JS_VERSION = "2.6.347";
        const PDF_JS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.min.js`;
        const PDF_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.js`;

        if (window.pdfjsLib) {
            setIsPdfJsReady(true);
            return;
        }
        
        const script = document.createElement('script');
        script.src = PDF_JS_URL;
        
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
            setIsPdfJsReady(true);
        };
        
        script.onerror = () => setError("Failed to load the PDF processing library. Please refresh the page.");
        document.body.appendChild(script);

        return () => {
            const scriptElement = document.querySelector(`script[src="${script.src}"]`);
            if (scriptElement) document.body.removeChild(scriptElement);
        };
    }, []);

    const getTextFromPdf = async (file) => {
        if (!isPdfJsReady) throw new Error("PDF library is not ready.");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    };

    const onDrop = useCallback(acceptedFiles => {
        const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
        setResumes(prev => [...prev, ...pdfFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } });
    
    // This function now calls our own backend proxy server
    const callBackendApi = async (prompt, isJson = false) => {
        // Use the live URL of your backend deployed on Render
        const backendUrl = 'https://resume-scanner-backend-yqfs.onrender.com/api/analyze';

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, isJson })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.error || "An unknown error occurred with the backend server.");
        }

        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        return isJson ? JSON.parse(text) : text;
    };

    const handleEnhanceJD = async () => {
        if (!jobDescription.trim()) {
            setError("Please enter a job description first.");
            return;
        }
        setIsEnhancing(true);
        setError(null);
        try {
            const prompt = `You are an expert recruiter and copywriter. Enhance the following job description to make it more appealing, clear, and inclusive for top candidates. Ensure it effectively outlines responsibilities and qualifications and sells the company culture. Return only the enhanced job description text, without any preamble.\n\nJob Description:\n---\n${jobDescription}`;
            const enhancedJD = await callBackendApi(prompt);
            setJobDescription(enhancedJD);
        } catch (err) {
            setError(`Failed to enhance: ${err.message}`);
        } finally {
            setIsEnhancing(false);
        }
    };
    
    const handleGenerateEmail = async (candidateAnalysis) => {
        setIsGeneratingEmail(true);
        setEmailContent('');
        setShowEmailModal(true);
        try {
            const { candidateName, strengths } = candidateAnalysis.analysis;
            const jobTitle = analysisResults[0]?.analysis.jobTitle || 'the role';

            const prompt = `You are a friendly and professional recruiter. Draft a personalized outreach email to "${candidateName}" inviting them to an interview for the "${jobTitle}" position. Reference their specific strengths, such as "${strengths.join(', ')}", to show you've read their resume carefully. Keep the tone enthusiastic and professional. Return only the email body as plain text.`;
            const generatedEmail = await callBackendApi(prompt);
            setEmailContent(generatedEmail);
        } catch(err) {
            setEmailContent(`Failed to generate email: ${err.message}`);
        } finally {
            setIsGeneratingEmail(false);
        }
    };


    const handleAnalysis = async () => {
        if (!jobDescription.trim() || resumes.length === 0) {
            setError("Please provide a job description and at least one resume.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysisResults([]);

        const analysisPrompt = (resumeText) => `
            You are a world-class HR professional and an expert resume screener. Analyze the provided resume against the given job description. Provide a detailed, structured analysis in JSON format.

            The JSON object must have the following keys:
            - "jobTitle": (string) The job title, extracted from the job description.
            - "candidateName": (string) The candidate's full name, if found.
            - "suitabilityScore": (number) A score from 0 to 100 indicating how well the resume matches the job description.
            - "matchSummary": (string) A concise one-paragraph summary explaining the score and the candidate's fit.
            - "strengths": (array of strings) Key strengths and qualifications that align with the job description.
            - "potentialGaps": (array of strings) Potential gaps or missing qualifications.
            - "suggestedQuestions": (array of strings) 2-3 insightful interview questions to ask the candidate.

            Job Description:\n---\n${jobDescription}\n---\nResume:\n---\n${resumeText}\n---

            Provide your analysis in the specified JSON format.`;

        const results = [];
        for (const resumeFile of resumes) {
            try {
                const resumeText = await getTextFromPdf(resumeFile);
                const analysis = await callBackendApi(analysisPrompt(resumeText), true);
                results.push({ fileName: resumeFile.name, analysis });
            } catch (err) {
                results.push({ fileName: resumeFile.name, analysis: { error: `Failed to analyze: ${err.message}` } });
            }
        }
        
        results.sort((a, b) => (b.analysis.suitabilityScore || 0) - (a.analysis.suitabilityScore || 0));
        setAnalysisResults(results);
        setIsLoading(false);
    };

    const removeResume = (fileName) => setResumes(resumes.filter(f => f.name !== fileName));

    return (
        <>
            <div className="bg-slate-50 min-h-screen font-sans text-slate-800">
                <div className="container mx-auto p-4 md:p-8">
                    <header className="text-center mb-10">
                        <h1 className="text-4xl md:text-5xl font-bold text-slate-900">AI Resume Screener</h1>
                    </header>

                    <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6">
                            <div className="relative">
                                <label htmlFor="jobDescription" className="block text-lg font-semibold mb-2 text-slate-700">1. Paste Job Description</label>
                                <textarea id="jobDescription" rows="8" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the full job description here..." className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"></textarea>
                                <button onClick={handleEnhanceJD} disabled={isEnhancing || !jobDescription} className="absolute bottom-3 right-3 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-md hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <SparkleIcon /> {isEnhancing ? 'Enhancing...' : 'Enhance with AI'}
                                </button>
                            </div>

                            <div>
                                <label className="block text-lg font-semibold mb-2 text-slate-700">2. Upload Resumes (PDF)</label>
                                <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}>
                                    <input {...getInputProps()} />
                                    <div className="flex flex-col items-center"><UploadIcon /><p className="mt-2 text-slate-600">{isDragActive ? "Drop the files here..." : "Drag 'n' drop PDF files here, or click to select"}</p></div>
                                </div>
                            </div>

                            {resumes.length > 0 && (
                                <div className="space-y-2"><h3 className="font-semibold">Uploaded Files:</h3>{resumes.map(file => (<div key={file.name} className="flex justify-between items-center bg-slate-100 p-2 rounded-lg"><div className="flex items-center space-x-2"><FileIcon /><span className="text-sm">{file.name}</span></div><button onClick={() => removeResume(file.name)} className="text-red-500 hover:text-red-700 font-bold">&times;</button></div>))}</div>
                            )}
                            
                            <button onClick={handleAnalysis} disabled={isLoading || !isPdfJsReady} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none">
                                {isLoading ? 'Analyzing...' : (!isPdfJsReady ? 'Loading PDF Library...' : 'Analyze Resumes')}
                            </button>
                            {error && <p className="text-red-500 text-center">{error}</p>}
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-lg">
                            <h2 className="text-2xl font-bold mb-4 text-slate-800">Analysis Results</h2>
                            {isLoading && <LoadingSpinner />}
                            {!isLoading && analysisResults.length === 0 && <div className="text-center text-slate-500 py-16"><p>Your analysis will appear here.</p></div>}
                            <div className="space-y-4">{analysisResults.map((result, index) => (<ResultCard key={index} result={result} onGenerateEmail={handleGenerateEmail} />))}</div>
                        </div>
                    </main>
                </div>
            </div>
            {showEmailModal && <EmailModal content={emailContent} isLoading={isGeneratingEmail} onClose={() => setShowEmailModal(false)} />}
        </>
    );
}

// --- Result Card Component ---
const ResultCard = ({ result, onGenerateEmail }) => {
    const { fileName, analysis } = result;
    if (analysis.error) {
        return <div className="border border-red-200 bg-red-50 p-4 rounded-lg"><h3 className="font-bold text-red-700">{fileName}</h3><p className="text-red-600">{analysis.error}</p></div>;
    }

    const { suitabilityScore, matchSummary, strengths, potentialGaps, suggestedQuestions, candidateName } = analysis;
    const getScoreColor = (score) => score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="border border-slate-200 p-4 rounded-lg transition-shadow hover:shadow-md">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-slate-900">{candidateName || fileName}</h3>
                <div className="flex items-center space-x-2"><span className="font-semibold text-lg">{suitabilityScore}%</span><div className="w-20 h-2.5 bg-slate-200 rounded-full"><div className={`h-2.5 rounded-full ${getScoreColor(suitabilityScore)}`} style={{ width: `${suitabilityScore}%` }}></div></div></div>
            </div>
            <p className="text-slate-600 mb-4 text-sm">{matchSummary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-green-50 p-3 rounded-lg"><h4 className="font-semibold text-green-800 mb-2">Strengths</h4><ul className="list-disc list-inside space-y-1 text-green-700">{strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                <div className="bg-red-50 p-3 rounded-lg"><h4 className="font-semibold text-red-800 mb-2">Potential Gaps</h4><ul className="list-disc list-inside space-y-1 text-red-700">{potentialGaps?.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
            </div>
            <div className="mt-4"><h4 className="font-semibold text-slate-700 mb-2">Suggested Interview Questions</h4><ul className="list-decimal list-inside space-y-1 text-slate-600 text-sm">{suggestedQuestions?.map((q, i) => <li key={i}>{q}</li>)}</ul></div>
            <div className="mt-4 text-right">
                <button onClick={() => onGenerateEmail(result)} disabled={suitabilityScore < 70} className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <SparkleIcon /> Draft Outreach Email
                </button>
            </div>
        </div>
    );
};

// --- Email Modal Component ---
const EmailModal = ({ content, isLoading, onClose }) => {
    const [copySuccess, setCopySuccess] = useState('');

    const copyToClipboard = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopySuccess('Copied!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('Failed to copy.');
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold">Generated Outreach Email</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {isLoading ? <LoadingSpinner text="Generating Email..." /> : <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{content}</pre>}
                </div>
                <div className="flex justify-end items-center p-4 border-t bg-slate-50">
                    {copySuccess && <span className="text-sm text-green-600 mr-4">{copySuccess}</span>}
                    <button onClick={copyToClipboard} disabled={isLoading || !content} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400">Copy Text</button>
                </div>
            </div>
        </div>
    );
};
