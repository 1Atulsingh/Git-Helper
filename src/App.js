import React, { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
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

// GitHub OAuth App credentials would normally be stored securely
// For demo purposes, we're using placeholder values
const GITHUB_CLIENT_ID = 'Ov23liar9wjLDWrJz1Lx';
const GITHUB_CLIENT_SECRET = '501fe2d9197171e5130909d0794f1eb08d57298f';



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
  const [commitMessage, setCommitMessage] = useState('');
  const [notification, setNotification] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

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
        sort: 'updated',
        per_page: 100
      });
      setRepositories(repos);
    } catch (error) {
      console.error('Error loading repositories:', error);
      showNotification('error', 'Failed to load repositories');
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
    if (!commitMessage.trim()) {
      showNotification('error', 'Please enter a commit message');
      return;
    }
    
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
      
      // Create blobs for each file
      const fileBlobs = await Promise.all(uploadFiles.map(async (file) => {
        // Read file content
        const content = await readFileAsBase64(file);
        
        // Create blob
        const { data: blobData } = await octokit.git.createBlob({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          content: content,
          encoding: 'base64'
        });
        
        return {
          path: currentPath === '/' ? file.name : `${currentPath}/${file.name}`,
          mode: '100644', // Regular file
          type: 'blob',
          sha: blobData.sha
        };
      }));
      
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
        force: true
      });
      
      // Refresh contents
      await loadRepositoryContents(selectedRepo, currentPath, currentBranch);

      // After successful upload and commit
      // Refresh contents with a slight delay to ensure GitHub API has updated
    setTimeout(async () => {
    const success = await loadRepositoryContents(selectedRepo, currentPath, currentBranch);
    if (!success) {
    // Try one more time if the first attempt fails
    setTimeout(() => {
      loadRepositoryContents(selectedRepo, currentPath, currentBranch);
    }, 1000);
  }
}, 500);

      
      // Close modal and clear state
      setShowUploadModal(false);
      setUploadFiles([]);
      setCommitMessage('');
      
      showNotification('success', `Successfully uploaded ${uploadFiles.length} file(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      showNotification('error', 'Failed to upload files');
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
                  {contents.map(item => (
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
              <h4>Files to upload:</h4>
              <FileList>
                {uploadFiles.map((file, index) => (
                  <FileListItem key={index}>
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </FileListItem>
                ))}
              </FileList>
              <CommitMessageInput>
                <label>Commit message:</label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Enter commit message..."
                />
              </CommitMessageInput>
            </ModalBody>
            <ModalFooter>
              <CancelButton onClick={() => setShowUploadModal(false)}>Cancel</CancelButton>
              <UploadButton onClick={handleUploadFiles}>Commit Changes</UploadButton>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </AppContainer>
  );
};

export default App;
