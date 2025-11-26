import React, { useState } from 'react';
import { GitHubConfig } from '../types';
import { Github, Key, FolderGit2, FolderOpen, Save } from 'lucide-react';

interface ConfigFormProps {
  initialConfig: GitHubConfig;
  onSave: (config: GitHubConfig) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ initialConfig, onSave }) => {
  const [config, setConfig] = useState<GitHubConfig>(initialConfig);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-700 rounded-lg">
          <Github className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">GitHub Configuration</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
            Personal Access Token
          </label>
          <div className="relative group">
            <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="password"
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 placeholder-gray-600 transition-all"
              placeholder="ghp_xxxxxxxxxxxx"
              required
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Token needs 'repo' scope permissions (or 'public_repo' if public).</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
              Owner / User
            </label>
            <div className="relative group">
              <FolderGit2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="text"
                value={config.owner}
                onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 placeholder-gray-600 transition-all"
                placeholder="username"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
              Repository
            </label>
            <div className="relative group">
              <FolderOpen className="absolute left-3 top-2.5 w-4 h-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="text"
                value={config.repo}
                onChange={(e) => setConfig({ ...config, repo: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 placeholder-gray-600 transition-all"
                placeholder="my-novels"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
            Path Prefix
          </label>
           <input
              type="text"
              value={config.pathPrefix}
              onChange={(e) => setConfig({ ...config, pathPrefix: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 placeholder-gray-600 transition-all"
              placeholder="novels/my-novels/"
            />
            <p className="mt-1 text-xs text-gray-500">Folder structure inside the repo (end with /)</p>
        </div>

        <div className="pt-2">
            <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-all shadow-lg hover:shadow-emerald-900/50"
            >
                <Save className="w-4 h-4" />
                Connect to GitHub
            </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigForm;