import { GitHubConfig } from '../types';

export const validateRepo = async (config: GitHubConfig): Promise<boolean> => {
  try {
    const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error("GitHub validation error:", error);
    return false;
  }
};

/**
 * Uploads or updates a file in the GitHub repository.
 * Returns an object indicating success and an optional error message.
 */
export const uploadFileToGitHub = async (
  config: GitHubConfig,
  fileName: string,
  content: string,
  commitMessage: string
): Promise<{ success: boolean; message?: string }> => {
  // Normalize path: remove leading slashes, ensure single slashes inside
  const rawPath = `${config.pathPrefix}${fileName}`.replace(/\/+/g, '/').replace(/^\//, '');
  
  // URL Encode each segment of the path to handle Chinese characters and spaces correctly
  // e.g. "novels/斗罗大陆/chap1.md" -> "novels/%E6%96%97.../chap1.md"
  const encodedPath = rawPath.split('/').map(encodeURIComponent).join('/');
  
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;

  // 1. Check if file exists to get SHA (needed for updates)
  let sha: string | undefined;
  try {
    const checkResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      sha = data.sha;
    }
  } catch (e) {
    // Ignore error if file doesn't exist
  }

  // 2. Encode content to Base64 (handling UTF-8)
  // standard hack for utf-8 strings to base64
  const base64Content = btoa(unescape(encodeURIComponent(content)));

  // 3. PUT request
  try {
    const body: any = {
      message: commitMessage,
      content: base64Content,
    };
    if (sha) {
      body.sha = sha;
    }

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!putResponse.ok) {
      const errText = await putResponse.text();
      let friendlyError = `HTTP ${putResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        friendlyError = errJson.message || friendlyError;
      } catch (e) {}
      
      console.error(`GitHub Upload Failed [${putResponse.status}]:`, errText);
      return { success: false, message: friendlyError };
    }

    return { success: true };
  } catch (error: any) {
    console.error("GitHub upload error:", error);
    return { success: false, message: error.message || "Network error" };
  }
};