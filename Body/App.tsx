import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  GitHubConfig, 
  AppState, 
  LogEntry, 
  LogLevel, 
  NovelMetadata, 
  Chapter 
} from './types';
import ConfigForm from './components/ConfigForm';
import TerminalLog from './components/TerminalLog';
import { validateRepo, uploadFileToGitHub } from './services/githubService';
import { searchNovelMetadata, fetchChapterContent } from './services/geminiService';
import { 
  Book, 
  Search, 
  Loader2, 
  Play, 
  Pause, 
  FileText, 
  CheckCircle2, 
  Settings as SettingsIcon,
  Library,
  Link as LinkIcon
} from 'lucide-react';

// Default initial config based on user preferences
const DEFAULT_CONFIG: GitHubConfig = {
  token: '',
  owner: 'liquanlianshi',
  repo: 'novels',
  pathPrefix: 'novels/my-novels/',
};

function App() {
  // --- State ---
  const [config, setConfig] = useState<GitHubConfig>(DEFAULT_CONFIG);
  const [appState, setAppState] = useState<AppState>('setup');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Crawler Data
  const [novel, setNovel] = useState<NovelMetadata | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [crawlingActive, setCrawlingActive] = useState(false);
  const [progress, setProgress] = useState(0);

  // Track if component is mounted to prevent state updates on unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // --- Helpers ---
  const addLog = useCallback((message: string, level: LogLevel = LogLevel.INFO) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      level,
      message
    }]);
  }, []);

  // --- Handlers ---

  const handleConfigSave = async (newConfig: GitHubConfig) => {
    addLog("Validating GitHub credentials...", LogLevel.INFO);
    const isValid = await validateRepo(newConfig);
    
    if (isValid) {
      setConfig(newConfig);
      addLog(`Connected to repo: ${newConfig.owner}/${newConfig.repo}`, LogLevel.SUCCESS);
      setAppState('search');
    } else {
      addLog("Failed to connect to GitHub repository. Check token/permissions.", LogLevel.ERROR);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    addLog(`Searching for novel: "${searchQuery}"...`, LogLevel.INFO);
    setNovel(null);
    setChapters([]);

    try {
      const result = await searchNovelMetadata(searchQuery);
      if (result) {
        setNovel(result);
        addLog(`Found: ${result.title} by ${result.author}`, LogLevel.SUCCESS);
        addLog(`Found ${result.chapters.length} initial chapters available for scraping.`, LogLevel.INFO);
        
        // Initialize chapter objects
        const initChapters: Chapter[] = result.chapters.map((title, idx) => ({
          id: idx + 1,
          title,
          status: 'pending'
        }));
        setChapters(initChapters);
        setAppState('preview');
      } else {
        addLog("No novel found or Gemini refused to return data.", LogLevel.WARNING);
      }
    } catch (err) {
      addLog(`Search failed: ${err}`, LogLevel.ERROR);
    } finally {
      setIsSearching(false);
    }
  };

  const startCrawling = () => {
    if (!novel || chapters.length === 0) return;
    setAppState('crawling');
    setCrawlingActive(true);
    addLog("Starting batch crawl process...", LogLevel.INFO);
  };

  const stopCrawling = () => {
    setCrawlingActive(false);
    addLog("Crawling paused by user.", LogLevel.WARNING);
  };

  // --- Crawler Effect (The Brain) ---
  useEffect(() => {
    if (!crawlingActive || appState !== 'crawling') return;

    let timer: ReturnType<typeof setTimeout>;

    const processNextChapter = async () => {
      if (!isMountedRef.current) return;

      // Find first pending chapter
      const chapterIndex = chapters.findIndex(c => c.status === 'pending');
      
      if (chapterIndex === -1) {
        addLog("All scheduled chapters processed.", LogLevel.SUCCESS);
        setCrawlingActive(false);
        setAppState('finished');
        return;
      }

      const chapter = chapters[chapterIndex];
      
      // Update status to crawling
      setChapters(prev => {
        const next = [...prev];
        next[chapterIndex] = { ...next[chapterIndex], status: 'crawling' };
        return next;
      });

      addLog(`Fetching content: ${chapter.title}`, LogLevel.INFO);

      // 1. Fetch Content from Gemini
      const content = await fetchChapterContent(novel!.title, chapter.title);
      
      // 2. Upload to GitHub
      // Note: We use isMountedRef.current to check mount status, NOT a local let variable
      // because the state update above triggers a re-render/cleanup cycle.
      if (isMountedRef.current) {
        addLog(`Uploading to GitHub: ${chapter.title}`, LogLevel.INFO);
        
        // Sanitize filename helper: Replace unsafe chars but ALLOW unicode (Chinese)
        // Also trim spaces to avoid filesystem issues
        const sanitize = (str: string) => str.replace(/[<>:"/\\|?*]+/g, '_').replace(/[\r\n]+/g, '').trim();

        const safeNovelTitle = sanitize(novel!.title);
        const safeChapterTitle = sanitize(chapter.title);
        
        // Construct path: Novel_Name/001_Chapter_Name.md
        // The pathPrefix (e.g., 'novels/my-novels/') is prepended in githubService
        const fileName = `${safeNovelTitle}/${String(chapter.id).padStart(3, '0')}_${safeChapterTitle}.md`;
        
        const uploadResult = await uploadFileToGitHub(
            config, 
            fileName, 
            content, 
            `Add ${chapter.title} to ${novel!.title}`
        );

        // 3. Update Status
        if (isMountedRef.current) {
            if (uploadResult.success) {
                addLog(`Saved ${chapter.title} successfully.`, LogLevel.SUCCESS);
                setChapters(prev => {
                    const next = [...prev];
                    next[chapterIndex] = { ...next[chapterIndex], status: 'success', content };
                    return next;
                });
            } else {
                addLog(`Failed to save ${chapter.title}: ${uploadResult.message}`, LogLevel.ERROR);
                setChapters(prev => {
                    const next = [...prev];
                    next[chapterIndex] = { ...next[chapterIndex], status: 'error' };
                    return next;
                });
            }
            
            // Update progress bar
            const completed = chapters.filter(c => c.status === 'success' || c.status === 'error').length + 1;
            setProgress((completed / chapters.length) * 100);

            // Small delay to prevent API flooding and race conditions
            if (crawlingActive) {
                timer = setTimeout(processNextChapter, 2000); 
            }
        }
      }
    };

    // Trigger the loop
    timer = setTimeout(processNextChapter, 500);

    return () => {
        clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlingActive, chapters, config, novel]);


  // --- Render ---

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-900/30 rounded-lg">
                <Book className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Novel<span className="text-emerald-400">Sync</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
             {appState !== 'setup' && (
                 <button 
                    onClick={() => setAppState('setup')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                 >
                     <SettingsIcon className="w-4 h-4" />
                     <span className="hidden sm:inline">Config</span>
                 </button>
             )}
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${appState === 'crawling' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="uppercase text-xs font-bold tracking-wider text-gray-300">
                    {appState === 'crawling' ? 'SYSTEM ACTIVE' : 'SYSTEM IDLE'}
                </span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactions */}
        <div className="lg:col-span-7 space-y-6">
            
            {/* Setup View */}
            {appState === 'setup' && (
                <div className="animate-fade-in">
                    <ConfigForm initialConfig={config} onSave={handleConfigSave} />
                </div>
            )}

            {/* Search View */}
            {(appState === 'search' || appState === 'preview' || appState === 'crawling' || appState === 'finished') && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl animate-fade-in relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gray-700 rounded-lg">
                            <Library className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Find Novel</h2>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="Enter novel name (e.g., 'Lord of the Mysteries' or '斗罗大陆')"
                                disabled={appState === 'crawling'}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching || appState === 'crawling'}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded-lg font-medium transition-all flex items-center justify-center min-w-[100px]"
                        >
                            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                        </button>
                    </form>
                </div>
            )}

            {/* Novel Details & Crawler Controls */}
            {novel && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-gray-700 bg-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-1">{novel.title}</h2>
                        <p className="text-emerald-400 font-medium mb-3">by {novel.author}</p>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">{novel.description}</p>
                        
                        {novel.sources && novel.sources.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-700/50">
                            <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" /> Sources
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {novel.sources.map((source, idx) => (
                                <a 
                                  key={idx}
                                  href={source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 px-2 py-1 rounded truncate max-w-[200px]"
                                >
                                  {new URL(source).hostname}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="p-6 bg-gray-900/50">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-gray-500" />
                                Chapter Queue ({chapters.length})
                            </h3>
                            {appState === 'preview' && (
                                <button
                                    onClick={startCrawling}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    Start Crawling
                                </button>
                            )}
                             {appState === 'crawling' && (
                                <button
                                    onClick={stopCrawling}
                                    className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
                                >
                                    <Pause className="w-4 h-4 fill-current" />
                                    Pause
                                </button>
                            )}
                             {appState === 'finished' && (
                                <div className="text-emerald-400 font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Complete
                                </div>
                            )}
                        </div>

                        {/* Progress Bar */}
                        {(appState === 'crawling' || appState === 'finished') && (
                            <div className="mb-6">
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                    <span>Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
                                        style={{ width: `${progress}%` }} 
                                    />
                                </div>
                            </div>
                        )}

                        {/* Chapter List */}
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 terminal-scroll">
                            {chapters.map((chapter) => (
                                <div 
                                    key={chapter.id} 
                                    className={`
                                        p-3 rounded-md border flex items-center justify-between text-sm transition-all
                                        ${chapter.status === 'crawling' ? 'bg-emerald-900/20 border-emerald-500/50' : ''}
                                        ${chapter.status === 'success' ? 'bg-gray-800 border-gray-700 text-gray-500' : ''}
                                        ${chapter.status === 'pending' ? 'bg-gray-800 border-gray-700 text-gray-300' : ''}
                                        ${chapter.status === 'error' ? 'bg-red-900/20 border-red-500/50 text-red-300' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-gray-500 text-xs w-8">#{chapter.id}</span>
                                        <span className="font-medium truncate max-w-[200px] sm:max-w-xs">{chapter.title}</span>
                                    </div>
                                    <div className="text-xs font-mono uppercase">
                                        {chapter.status === 'crawling' && <span className="text-emerald-400 animate-pulse">Running...</span>}
                                        {chapter.status === 'success' && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
                                        {chapter.status === 'pending' && <span className="text-gray-600">Pending</span>}
                                        {chapter.status === 'error' && <span className="text-red-400">Error</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Right Column: Logs */}
        <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-24">
                <TerminalLog logs={logs} />
                
                <div className="mt-6 p-4 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-400">
                    <h4 className="font-bold text-gray-300 mb-2 uppercase tracking-wide">How it works</h4>
                    <ul className="space-y-2 list-disc list-inside">
                        <li>Gemini AI searches specifically for the novel you requested.</li>
                        <li>It retrieves metadata and a chapter list.</li>
                        <li>The crawler iterates through the chapters, using Google Search Grounding to reconstruct or retrieve the text.</li>
                        <li>Each chapter is automatically committed to your GitHub repo as a Markdown file.</li>
                    </ul>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}

export default App;