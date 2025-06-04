import React, { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import JSZip from 'jszip'; // Import JSZip
import {
  AppContainer,
  Header,
  Title,
  UserInfo,
  UserName,
  LoginButton,
  LogoutButton,
  MainContent,
  Sidebar,
  SidebarHeader,
  RepoList,
  RepoItem,
  Content,
  RepositoryHeader,
  RepoName,
  BranchSelector,
  PathNavigator,
  PathItem,
  PathSeparator,
  FileExplorer,
  FileItem,
  FileIcon,
  FileName,
  DropZone,
  DropZoneText,
  WelcomeMessage,
  Notification,
  Modal,
  ModalContent,
  ModalHeader,
  CloseButton,
  ModalBody,
  FileList,
  FileListItem,
  CommitMessageInput,
  ModalFooter,
  CancelButton,
  UploadButton
} from './styles/StyledComponents';

// GitHub OAuth App credentials read from environment variables
const GITHUB_CLIENT_ID = process.env.REACT_APP_GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.REACT_APP_GITHUB_CLIENT_SECRET;



const App = () => {
  // State variables
  const [authenticated, setAuthenticated] = useState(false);
  const [octokit, setOctokit] = useState(null);
  const [user, setUser] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [contents, setContents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState("");
  const [notification, setNotification] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState(""); // State for the new folder name

  // Initialize GitHub on component mount
  useEffect(() => {
    // Check if we have a token in localStorage
    const token = localStorage.getItem('github_token');
    
    if (token) {
      initializeGitHub(token);
    }
  }, []);

  // Initialize GitHub with token
  const initializeGitHub = async (token) => {
    try {
      const octokitInstance = new Octokit({
        auth: token
      });
      
      setOctokit(octokitInstance);
      
      // Get authenticated user
      const { data: userData } = await octokitInstance.users.getAuthenticated();
      setUser(userData);
      setAuthenticated(true);
      
      // Load user repositories
      await loadUserRepositories(octokitInstance);
      
      showNotification('success', `Logged in as ${userData.login}`);
    } catch (error) {
      console.error('Authentication error:', error);
      localStorage.removeItem('github_token');
      setAuthenticated(false);
      showNotification('error', 'Authentication failed');
    }
  };

  // Load user repositories
  const loadUserRepositories = async (octokitInstance) => {
    try {
      const { data: repos } = await octokitInstance.repos.listForAuthenticatedUser({
        sort: "updated", // Keep sorting by updated initially, or change to full_name if preferred
        per_page: 100
      });
      // Sort repositories by name (case-insensitive)
      const sortedRepos = [...repos].sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setRepositories(sortedRepos);
    } catch (error) {
      console.error("Error loading repositories:", error);
      showNotification("error", "Failed to load repositories");
    }
  };

  // Load repository contents
  // Load repository contents
const loadRepositoryContents = async (repo, path = '', branch = 'main') => {
  if (!octokit || !repo) return;
  
  try {
    // Clear existing contents first to ensure UI updates
    setContents([]);
    
    // Ensure path is properly encoded
    const encodedPath = path ? path.replace(/^\//, '') : '';
    
    const { data: contentsData } = await octokit.repos.getContent({
      owner: repo.owner.login,
      repo: repo.name,
      path: encodedPath,
      ref: branch,
      // Add a cache-busting parameter
      headers: {
        'If-None-Match': '' // Prevents caching
      }
    });
    
    setContents(Array.isArray(contentsData) ? contentsData : [contentsData]);
    setCurrentPath(path || '/');
    
    // Also load branches
    const { data: branchesData } = await octokit.repos.listBranches({
      owner: repo.owner.login,
      repo: repo.name
    });
    
    setBranches(branchesData.map(b => b.name));
    setCurrentBranch(branch);
    
    return true; // Indicate successful loading
  } catch (error) {
    console.error('Error loading repository contents:', error);
    showNotification('error', 'Failed to load repository contents');
    return false;
  }
};


  // Handle repository selection
  const handleSelectRepository = async (repo) => {
    setSelectedRepo(repo);
    await loadRepositoryContents(repo);
  };

  // Handle branch selection
  const handleSelectBranch = async (branch) => {
    if (selectedRepo) {
      await loadRepositoryContents(selectedRepo, currentPath, branch);
    }
  };

  // Handle directory navigation
  const handleNavigate = async (item) => {
    if (item.type === 'dir') {
      await loadRepositoryContents(selectedRepo, item.path, currentBranch);
    } else {
      // View file content
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          path: item.path,
          ref: currentBranch
        });
        
        // For binary files, fileData.content will be base64 encoded
        // For text files, we can decode and display
        if (fileData.encoding === 'base64' && !isImageFile(fileData.name)) {
          const content = atob(fileData.content);
          // Here you would display the file content in a modal or viewer
          console.log('File content:', content);
          showNotification('info', `Viewing file: ${item.name}`);
        } else if (isImageFile(fileData.name)) {
          // Handle image files
          const imageUrl = `data:image/png;base64,${fileData.content}`;
          // Display image in a modal or viewer
          console.log('Image URL:', imageUrl);
          showNotification('info', `Viewing image: ${item.name}`);
        }
      } catch (error) {
        console.error('Error loading file content:', error);
        showNotification('error', 'Failed to load file content');
      }
    }
  };

  // Check if file is an image
  const isImageFile = (filename) => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  // Handle file upload via drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!authenticated || !selectedRepo) {
      showNotification('error', 'Please select a repository first');
      return;
    }
    
    const files = [];
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile();
          files.push(file);
        }
      }
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i]);
      }
    }
    
    if (files.length > 0) {
      setUploadFiles(files);
      setShowUploadModal(true);
    }
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle file upload and commit
  const handleUploadFiles = async () => {
    if (!newFolderName.trim()) {
      showNotification("error", "Please enter a name for the new folder");
      return;
    }
    if (!commitMessage.trim()) {
      showNotification("error", "Please enter a commit message");
      return;
    }

    showNotification("info", "Preparing upload... This may take a moment for large files or ZIP archives.");

    try {
      // Get the latest commit SHA for the branch
      const { data: refData } = await octokit.git.getRef({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        ref: `heads/${currentBranch}`
      });
      const latestCommitSha = refData.object.sha;

      // Get the base tree
      const { data: commitData } = await octokit.git.getCommit({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        commit_sha: latestCommitSha
      });
      const baseTreeSha = commitData.tree.sha;

      // --- Get existing files in the repository to check for duplicates --- 
      showNotification("info", "Checking for existing files...");
      let existingPaths = new Set();
      try {
        const { data: treeData } = await octokit.git.getTree({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          tree_sha: baseTreeSha,
          recursive: true
        });
        if (treeData.tree) {
          existingPaths = new Set(treeData.tree.map(item => item.path));
        }
      } catch (treeError) {
        // If the tree is too large, recursive fetch might fail. Handle gracefully.
        console.warn("Could not fetch full repository tree for duplicate check:", treeError);
        showNotification("warning", "Could not fully check for duplicates; proceeding with upload.");
        // Allow upload to proceed without duplicate check in this edge case
      }

      // --- Process dropped files (including unpacking ZIPs) ---
      const fileBlobs = [];
      const skippedFiles = [];
      const zip = new JSZip();

      for (const file of uploadFiles) {
        const baseFolderPath = currentPath === "/" ? newFolderName : `${currentPath}/${newFolderName}`;
        const cleanBaseFolderPath = baseFolderPath.replace(/^\/\//, ""); // Ensure no leading slash

        if (file.name.toLowerCase().endsWith(".zip")) {
          try {
            showNotification("info", `Unpacking ${file.name}...`);
            const zipData = await zip.loadAsync(file);
            const zipFolderName = file.name.replace(/\.zip$/i, ""); // Folder name from zip file name
            const fullZipFolderPath = `${cleanBaseFolderPath}/${zipFolderName}`.replace(/^\/\//, "");

            // Process each file within the zip
            const zipEntries = Object.values(zipData.files);
            for (const entry of zipEntries) {
              if (!entry.dir) { // Skip directories within the zip
                const filePath = `${fullZipFolderPath}/${entry.name}`.replace(/^\/\//, "");
                
                // --- Duplicate Check --- 
                if (existingPaths.has(filePath)) {
                  skippedFiles.push(entry.name); // Record skipped file
                  continue; // Skip this file
                }
                // --- End Duplicate Check ---

                const entryContent = await entry.async("base64");
                const { data: blobData } = await octokit.git.createBlob({
                  owner: selectedRepo.owner.login,
                  repo: selectedRepo.name,
                  content: entryContent,
                  encoding: "base64"
                });
                fileBlobs.push({
                  path: filePath,
                  mode: "100644",
                  type: "blob",
                  sha: blobData.sha
                });
              }
            }
            showNotification("info", `Finished unpacking ${file.name}.`);
          } catch (zipError) {
            console.error(`Error unpacking zip file ${file.name}:`, zipError);
            showNotification("error", `Failed to unpack ${file.name}. Skipping.`);
            continue; // Skip this zip file if unpacking fails
          }
        } else {
          // Handle regular files
          const filePath = `${cleanBaseFolderPath}/${file.name}`.replace(/^\/\//, "");
          
          // --- Duplicate Check --- 
          if (existingPaths.has(filePath)) {
            skippedFiles.push(file.name); // Record skipped file
            continue; // Skip this file
          }
          // --- End Duplicate Check ---

          const content = await readFileAsBase64(file);
          const { data: blobData } = await octokit.git.createBlob({
            owner: selectedRepo.owner.login,
            repo: selectedRepo.name,
            content: content,
            encoding: "base64"
          });
          fileBlobs.push({
            path: filePath,
            mode: "100644",
            type: "blob",
            sha: blobData.sha
          });
        }
      }

      if (fileBlobs.length === 0) {
        showNotification("warning", "No valid files processed for upload.");
        setShowUploadModal(false);
        setUploadFiles([]);
        setCommitMessage("");
        setNewFolderName("");
        return;
      }

      showNotification("info", "Creating commit...");

      // Create tree
      const { data: treeData } = await octokit.git.createTree({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        base_tree: baseTreeSha,
        tree: fileBlobs
      });

      // Create commit
      const { data: newCommitData } = await octokit.git.createCommit({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        message: commitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha]
      });

      // Update branch reference
      await octokit.git.updateRef({
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        ref: `heads/${currentBranch}`,
        sha: newCommitData.sha,
        force: false // Set force to false initially, handle conflicts if necessary
      });

      // Refresh contents after a delay
      showNotification("info", "Upload successful! Refreshing content...");
      setTimeout(async () => {
        const success = await loadRepositoryContents(selectedRepo, currentPath, currentBranch);
        if (!success) {
          setTimeout(() => {
            loadRepositoryContents(selectedRepo, currentPath, currentBranch);
          }, 1500); // Increased delay for second attempt
        }
      }, 1000); // Increased initial delay

      // Close modal and clear state
      setShowUploadModal(false);
      setUploadFiles([]);
      setCommitMessage("");
      setNewFolderName("");

      // Notify about skipped files, if any
      if (skippedFiles.length > 0) {
        showNotification("warning", `Skipped ${skippedFiles.length} duplicate file(s): ${skippedFiles.join(", ")}`)
      }

      showNotification("success", `Successfully processed upload to folder ${newFolderName}`);
    } catch (error) {
      console.error("Error uploading files:", error);
      // Provide more specific error feedback if possible
      if (error.status === 409) { // Conflict error
          showNotification("error", "Upload failed: Conflict detected. Please refresh and try again.");
      } else if (error.message.includes("path exists")) {
          showNotification("error", "Upload failed: Some files already exist. Duplicate handling not fully implemented yet.");
      } else {
          showNotification("error", `Upload failed: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Read file as base64
  // Improved readFileAsBase64 function with better error handling
const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } catch (error) {
          console.error('Error processing file data:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(error);
      };
      
      // Add a timeout in case the read operation hangs
      setTimeout(() => {
        if (reader.readyState !== 2) {
          reject(new Error('FileReader timeout'));
        }
      }, 10000);
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error setting up FileReader:', error);
      reject(error);
    }
  });
};


  // Show notification
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Handle login
  const handleLogin = () => {
    // For demo purposes, we're using a simplified approach
    const token = prompt('Enter your GitHub token:');
    if (token) {
      localStorage.setItem('github_token', token);
      initializeGitHub(token);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('github_token');
    setAuthenticated(false);
    setUser(null);
    setOctokit(null);
    setRepositories([]);
    setSelectedRepo(null);
    setContents([]);
  };

  return (
    <AppContainer>
      <Header>
        <Title>Git Helper Web</Title>
        {authenticated ? (
          <UserInfo>
            {user && <UserName>{user.login}</UserName>}
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </UserInfo>
        ) : (
          <LoginButton onClick={handleLogin}>Login with GitHub</LoginButton>
        )}
      </Header>

      {authenticated ? (
        <MainContent>
          <Sidebar>
            <SidebarHeader>Repositories</SidebarHeader>
            <RepoList>
              {repositories.map(repo => (
                <RepoItem 
                  key={repo.id} 
                  selected={selectedRepo && selectedRepo.id === repo.id}
                  onClick={() => handleSelectRepository(repo)}
                >
                  {repo.name}
                </RepoItem>
              ))}
            </RepoList>
          </Sidebar>

          <Content>
            {selectedRepo ? (
              <>
                <RepositoryHeader>
                  <RepoName>{selectedRepo.name}</RepoName>
                  <BranchSelector>
                    <label>Branch:</label>
                    <select 
                      value={currentBranch}
                      onChange={(e) => handleSelectBranch(e.target.value)}
                    >
                      {branches.map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </BranchSelector>
                </RepositoryHeader>

                <PathNavigator>
                  <PathItem onClick={() => loadRepositoryContents(selectedRepo, '', currentBranch)}>
                    Root
                  </PathItem>
                  {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((part, index, array) => {
                    const path = array.slice(0, index + 1).join('/');
                    return (
                      <React.Fragment key={path}>
                        <PathSeparator>/</PathSeparator>
                        <PathItem onClick={() => loadRepositoryContents(selectedRepo, path, currentBranch)}>
                          {part}
                        </PathItem>
                      </React.Fragment>
                    );
                  })}
                </PathNavigator>

                <FileExplorer>
                  {[...contents] // Create a shallow copy to sort
                    .sort((a, b) => {
                      // Prioritize directories
                      if (a.type === 'dir' && b.type !== 'dir') {
                        return -1; // a (dir) comes before b (file)
                      }
                      if (a.type !== 'dir' && b.type === 'dir') {
                        return 1; // b (dir) comes before a (file)
                      }
                      // If both are dirs or both are files, sort by name (case-insensitive)
                      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                    })
                    .map(item => (
                    <FileItem 
                      key={item.sha} 
                      onClick={() => handleNavigate(item)}
                    >
                      <FileIcon>{item.type === 'dir' ? '📁' : '📄'}</FileIcon>
                      <FileName>{item.name}</FileName>
                    </FileItem>
                  ))}
                </FileExplorer>

                <DropZone
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <DropZoneText>Drop files here to upload to current directory</DropZoneText>
                </DropZone>
              </>
            ) : (
              <WelcomeMessage>
                <h2>Select a Repository</h2>
                <p>Choose a repository from the sidebar to get started</p>
              </WelcomeMessage>
            )}
          </Content>
        </MainContent>
      ) : (
        <WelcomeMessage>
          <h2>Welcome to Git Helper Web</h2>
          <p>Please login with GitHub to get started</p>
          <LoginButton onClick={handleLogin}>Login with GitHub</LoginButton>
        </WelcomeMessage>
      )}

      {notification && (
        <Notification type={notification.type}>
          {notification.message}
        </Notification>
      )}

      {showUploadModal && (
        <Modal>
          <ModalContent>
            <ModalHeader>
              <h3>Upload Files</h3>
              <CloseButton onClick={() => setShowUploadModal(false)}>×</CloseButton>
            </ModalHeader>
            <ModalBody>
              <FileList>
                {uploadFiles.map((file, index) => (
                  <FileListItem key={index}>{file.name}</FileListItem>
                ))}
              </FileList>
              <CommitMessageInput>
                <label>New Folder Name (required):</label>
                <input 
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter name for the new folder..."
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #30363d", backgroundColor: "#161b22", color: "#c9d1d9", marginBottom: "16px" }}
                />
              </CommitMessageInput>
              <CommitMessageInput>
                <label>Commit Message:</label>
                <textarea 
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Enter your commit message here..."
                />
              </CommitMessageInput>
            </ModalBody>
            <ModalFooter>
              <CancelButton onClick={() => setShowUploadModal(false)}>Cancel</CancelButton>
              <UploadButton onClick={handleUploadFiles}>Upload & Commit</UploadButton>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </AppContainer>
  );
};

export default App;
