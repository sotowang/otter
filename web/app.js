const API_BASE = '/api/v1';
let authToken = localStorage.getItem('otter_token');

// Check auth on load
if (authToken) {
    showMainContent();
    // Wait for DOM to be fully loaded before calling loadConfigs
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadConfigs);
    } else {
        loadConfigs();
    }
}

// Helper function to show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const originalText = element.innerHTML;
        element.innerHTML = '<span class="loading"></span> Loading...';
        element.disabled = true;
        return originalText;
    }
    return '';
}

// Helper function to hide loading state
function hideLoading(elementId, originalText) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = originalText;
        element.disabled = false;
    }
}

// Helper function to show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 2000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInRight 0.3s ease-out;
        background-color: ${type === 'success' ? '#52c41a' : '#ff4d4f'};
    `;
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}



async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.querySelector('#loginSection button');
    const originalText = loginBtn.innerHTML;
    
    // Show loading state
    loginBtn.innerHTML = '<span class="loading"></span> Logging in...';
    loginBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error('Login failed');

        const data = await response.json();
        authToken = data.token;
        // Store username and token in localStorage
        localStorage.setItem('otter_token', authToken);
        localStorage.setItem('otter_username', username);
        showMainContent();
        loadConfigs();
        showNotification('Login successful');
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    } finally {
        // Restore button state
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('otter_token');
    localStorage.removeItem('otter_username');
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    showNotification('Logged out successfully');
}

function showMainContent() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Display username
    const usernameDisplay = document.getElementById('usernameDisplay');
    const username = localStorage.getItem('otter_username');
    if (usernameDisplay && username) {
        usernameDisplay.textContent = `Welcome, ${username}`;
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

async function loadConfigs() {
    const namespace = document.getElementById('namespace').value;
    const group = document.getElementById('group').value;
    if (!namespace || !group) return;
    
    const loadBtn = document.querySelector('.load-btn');
    const configTable = document.getElementById('configTable');
    const originalText = loadBtn ? loadBtn.innerHTML : '';
    
    // Show loading state in button
    if (loadBtn) {
        loadBtn.innerHTML = '<span class="loading"></span> Loading...';
        loadBtn.disabled = true;
    }
    
    // Show loading state in table
    if (configTable) {
        const tbody = configTable.querySelector('tbody');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999; padding: 40px;"><span class="loading"></span> Loading configs...</td></tr>';
    }

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs`, {
            headers: getHeaders()
        });
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) {
            throw new Error('Failed to load configs');
        }
        const configs = await response.json();
        renderConfigs(configs || []);
    } catch (error) {
        console.error(error);
        showNotification('Error loading configs: ' + error.message, 'error');
        // Show error state in table
        if (configTable) {
            const tbody = configTable.querySelector('tbody');
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff4d4f; padding: 40px;">Failed to load configs</td></tr>';
        }
    } finally {
        // Restore button state
        if (loadBtn) {
            loadBtn.innerHTML = originalText;
            loadBtn.disabled = false;
        }
    }
}

function renderConfigs(configs) {
    const tbody = document.querySelector('#configTable tbody');
    tbody.innerHTML = '';

    if (configs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">No configs found</td></tr>';
        return;
    }

    configs.forEach(cfg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cfg.key}</td>
            <td>${cfg.value}</td>
            <td>${cfg.type || 'text'}</td>
            <td>${cfg.version}</td>
            <td class="actions">
                <button onclick="editConfig('${cfg.key}', '${escapeHtml(cfg.value)}', '${cfg.type || 'text'}')">Edit</button>
                <button onclick="showHistory('${cfg.key}')">History</button>
                <button onclick="deleteConfig('${cfg.key}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveConfig() {
    const namespace = document.getElementById('namespace').value;
    const group = document.getElementById('group').value;
    const key = document.getElementById('key').value;
    const value = document.getElementById('value').value;
    const configType = document.getElementById('configType').value;

    if (!namespace || !group || !key) {
        showNotification('Namespace, Group and Key are required', 'error');
        return;
    }

    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn.innerHTML;
    
    // Show loading state
    saveBtn.innerHTML = '<span class="loading"></span> Saving...';
    saveBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ value, type: configType })
        });

        if (!response.ok) {
            throw new Error('Failed to save config');
        }

        // Close modal and clear form
        closeCreateConfigModal();
        
        // Reset form fields and enable key input
        const keyInput = document.getElementById('key');
        if (keyInput) {
            keyInput.value = '';
            keyInput.disabled = false;
        }
        document.getElementById('value').value = '';
        document.getElementById('configType').value = 'text'; // Reset to default type

        // Reload list
        await loadConfigs();
        showNotification('Config saved successfully');
    } catch (error) {
        console.error(error);
        showNotification('Error saving config: ' + error.message, 'error');
    } finally {
        // Restore button state
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteConfig(key) {
    if (!confirm(`Are you sure you want to delete ${key}?`)) return;

    const namespace = document.getElementById('namespace').value;
    const group = document.getElementById('group').value;

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete config');
        }

        await loadConfigs();
        showNotification('Config deleted successfully');
    } catch (error) {
        console.error(error);
        showNotification('Error deleting config: ' + error.message, 'error');
    }
}

async function showHistory(key) {
    const namespace = document.getElementById('namespace').value;
    const group = document.getElementById('group').value;

    document.getElementById('historyModal').style.display = 'block';
    document.getElementById('historyKey').innerText = key;
    
    // Show loading state in modal
    const historyTableBody = document.querySelector('#historyTable tbody');
    historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;"><span class="loading"></span> Loading history...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}/history`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to load history');
        const histories = await response.json();
        renderHistory(histories || [], key);
    } catch (error) {
        console.error(error);
        showNotification('Error loading history: ' + error.message, 'error');
        historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff4d4f; padding: 20px;">Failed to load history</td></tr>';
    }
}

function renderHistory(histories, key) {
    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '';

    if (histories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">No history found</td></tr>';
        return;
    }

    histories.forEach(h => {
        const tr = document.createElement('tr');
        const date = new Date(h.created_at).toLocaleString();
        tr.innerHTML = `
            <td>${h.version}</td>
            <td>${escapeHtml(h.value)}</td>
            <td>${h.op_type}</td>
            <td>${date}</td>
            <td>
                ${h.op_type !== 'DELETE' ? `<button onclick="rollbackConfig('${key}', ${h.version})">Rollback</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function closeHistory() {
    document.getElementById('historyModal').style.display = 'none';
}

async function rollbackConfig(key, version) {
    if (!confirm(`Rollback ${key} to version ${version}?`)) return;

    const namespace = document.getElementById('namespace').value;
    const group = document.getElementById('group').value;
    
    // Show loading state in modal
    const historyTableBody = document.querySelector('#historyTable tbody');
    const originalContent = historyTableBody.innerHTML;
    historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;"><span class="loading"></span> Rolling back...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}/rollback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ version: version })
        });

        if (!response.ok) throw new Error('Failed to rollback');

        showNotification('Rollback successful');
        closeHistory();
        await loadConfigs();
    } catch (error) {
        console.error(error);
        showNotification('Error rolling back: ' + error.message, 'error');
        // Restore original content
        historyTableBody.innerHTML = originalContent;
    }
}

function editConfig(key, value, type = 'text') {
    const modal = document.getElementById('createConfigModal');
    const modalTitle = modal.querySelector('.modal-header h3');
    const keyInput = document.getElementById('key');
    const valueInput = document.getElementById('value');
    const typeSelect = document.getElementById('configType');
    
    if (modal && modalTitle && keyInput && valueInput && typeSelect) {
        // Change modal title for edit mode
        modalTitle.textContent = 'Edit Config';
        
        // Fill form with existing data
        keyInput.value = key;
        keyInput.disabled = true; // Disable key input for editing
        valueInput.value = value;
        typeSelect.value = type; // Set config type
        
        // Open the modal
        modal.style.display = 'block';
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Add animation styles for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Load namespaces if authenticated
    if (authToken) {
        loadNamespaces();
    }
});

// Load namespaces list
async function loadNamespaces() {
    try {
        const response = await fetch(`${API_BASE}/namespaces`, {
            headers: getHeaders()
        });
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) {
            throw new Error('Failed to load namespaces');
        }
        const namespaces = await response.json();
        renderNamespaces(namespaces || []);
    } catch (error) {
        console.error(error);
        showNotification('Error loading namespaces: ' + error.message, 'error');
    }
}

// Render namespaces list
function renderNamespaces(namespaces) {
    const tbody = document.querySelector('#namespaceTable tbody');
    tbody.innerHTML = '';

    if (namespaces.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999; padding: 40px;">No namespaces found</td></tr>';
        return;
    }

    namespaces.forEach(ns => {
        const tr = document.createElement('tr');
        const isDefault = ns === 'public';
        tr.innerHTML = `
            <td>
                <div class="namespace-info">
                    <span class="namespace-name">${ns}</span>
                    ${isDefault ? '<span class="namespace-tag default-tag">Default</span>' : ''}
                </div>
            </td>
            <td>
                <span class="status-badge active">Active</span>
            </td>
            <td class="actions">
                ${isDefault ? '<button disabled class="disabled-btn">Default</button>' : `<button onclick="deleteNamespace('${ns}')" class="delete-btn">Delete</button>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Update namespace selector
    updateNamespaceSelector(namespaces);
}

// Update namespace selector
function updateNamespaceSelector(namespaces) {
    const namespaceSelect = document.getElementById('namespace');
    if (!namespaceSelect) return;
    
    // Save current selected value
    const currentValue = namespaceSelect.value;
    
    // Clear existing options except the default one
    namespaceSelect.innerHTML = '';
    
    // Add all namespaces as options
    namespaces.forEach(ns => {
        const option = document.createElement('option');
        option.value = ns;
        option.textContent = ns;
        namespaceSelect.appendChild(option);
    });
    
    // Restore current selected value if it still exists
    if (namespaces.includes(currentValue)) {
        namespaceSelect.value = currentValue;
    } else if (namespaces.length > 0) {
        // If current value doesn't exist, select the first one
        namespaceSelect.value = namespaces[0];
    }
    
    // Add change event listener for auto-loading configs
    namespaceSelect.onchange = function() {
        loadConfigs();
    };
}

// Open create namespace modal
function openCreateNamespaceModal() {
    const modal = document.getElementById('createNamespaceModal');
    if (modal) {
        modal.style.display = 'block';
        // Clear form fields and error messages
        document.getElementById('newNamespace').value = '';
        document.getElementById('namespaceError').style.display = 'none';
        // Focus on input field
        document.getElementById('newNamespace').focus();
    }
}

// Close create namespace modal
function closeCreateNamespaceModal() {
    const modal = document.getElementById('createNamespaceModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear form fields and error messages
        document.getElementById('newNamespace').value = '';
        document.getElementById('namespaceError').style.display = 'none';
    }
}

// Create new namespace
async function createNamespace() {
    const namespaceInput = document.getElementById('newNamespace');
    const namespaceError = document.getElementById('namespaceError');
    const namespaceName = namespaceInput.value.trim();
    
    // Form validation
    if (!namespaceName) {
        namespaceError.textContent = 'Namespace name cannot be empty';
        namespaceError.style.display = 'block';
        namespaceInput.focus();
        return;
    }
    
    // Validate namespace name format (alphanumeric, underscores, and hyphens only)
    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(namespaceName)) {
        namespaceError.textContent = 'Namespace name can only contain alphanumeric characters, underscores, and hyphens';
        namespaceError.style.display = 'block';
        namespaceInput.focus();
        return;
    }
    
    // Hide error message if validation passes
    namespaceError.style.display = 'none';

    const createBtn = event.target;
    const originalText = createBtn.innerHTML;
    createBtn.innerHTML = '<span class="loading"></span> Creating...';
    createBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/namespaces`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name: namespaceName })
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to create namespace');
        }

        // Close modal and clear form
        closeCreateNamespaceModal();
        
        // Reload namespaces list
        await loadNamespaces();
        showNotification('Namespace created successfully');
    } catch (error) {
        console.error(error);
        showNotification('Error creating namespace: ' + error.message, 'error');
    } finally {
        createBtn.innerHTML = originalText;
        createBtn.disabled = false;
    }
}

// Delete namespace
async function deleteNamespace(namespace) {
    if (!confirm(`Are you sure you want to delete namespace "${namespace}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to delete namespace');
        }

        // Reload namespaces list
        await loadNamespaces();
        showNotification('Namespace deleted successfully');
    } catch (error) {
        console.error(error);
        showNotification('Error deleting namespace: ' + error.message, 'error');
    }
}

// Navigation Interaction Logic
function setupNavigation() {
    // Mobile menu button functionality
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sideNav = document.getElementById('sideNav');
    
    if (mobileMenuBtn && sideNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            sideNav.classList.toggle('active');
        });
        
        // Close nav when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !sideNav.contains(e.target) && 
                !mobileMenuBtn.contains(e.target)) {
                mobileMenuBtn.classList.remove('active');
                sideNav.classList.remove('active');
            }
        });
    }
    
    // Nav link click handling
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all nav links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Handle submenu items
            const subItems = document.querySelectorAll('.nav-subitem');
            subItems.forEach(item => item.classList.remove('active'));
            
            // Show/hide content sections based on clicked link
            const section = link.getAttribute('data-section');
            showContentSection(section);
            
            // Close mobile menu if open
            if (mobileMenuBtn && sideNav) {
                mobileMenuBtn.classList.remove('active');
                sideNav.classList.remove('active');
            }
        });
    });
    
    // Nav subitem click handling
    const navSubItems = document.querySelectorAll('.nav-subitem');
    navSubItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all subitems
            navSubItems.forEach(subItem => subItem.classList.remove('active'));
            
            // Add active class to clicked subitem
            item.classList.add('active');
            
            // Show/hide content based on clicked subitem
            const subsection = item.getAttribute('data-subsection');
            showContentSubsection(subsection);
            
            // Close mobile menu if open
            if (mobileMenuBtn && sideNav) {
                mobileMenuBtn.classList.remove('active');
                sideNav.classList.remove('active');
            }
        });
    });
}

// Show content section based on navigation
function showContentSection(section) {
    // Hide all content sections
    const contentSections = document.querySelectorAll('.content-section');
    contentSections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Show the selected section
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Load corresponding data
    if (section === 'namespace-management') {
        loadNamespaces();
    } else if (section === 'config-management') {
        loadConfigs();
        // Show default subsection for config management
        showContentSubsection('config-list');
    }
}

// Show content subsection based on navigation
function showContentSubsection(subsection) {
    // Hide all subsections in config management
    const subsections = document.querySelectorAll('#config-management-section .content-subsection');
    subsections.forEach(sub => {
        sub.style.display = 'none';
    });
    
    // Show the selected subsection
    const targetSubsection = document.getElementById(subsection);
    if (targetSubsection) {
        targetSubsection.style.display = 'block';
    }
    
    // Load corresponding data if needed
    if (subsection === 'config-list') {
        loadConfigs();
    }
}

// Open create config modal
function openCreateConfigModal() {
    const modal = document.getElementById('createConfigModal');
    const modalTitle = modal.querySelector('.modal-header h3');
    const keyInput = document.getElementById('key');
    
    if (modal && modalTitle && keyInput) {
        // Change modal title for create mode
        modalTitle.textContent = 'Create Config';
        
        // Clear form fields and enable key input
        document.getElementById('key').value = '';
        document.getElementById('value').value = '';
        keyInput.disabled = false;
        
        // Open the modal
        modal.style.display = 'block';
    }
}

// Close create config modal
function closeCreateConfigModal() {
    const modal = document.getElementById('createConfigModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Reset form fields and enable key input when closing modal
        const keyInput = document.getElementById('key');
        if (keyInput) {
            keyInput.value = '';
            keyInput.disabled = false;
        }
        document.getElementById('value').value = '';
    }
}

// Open clone config modal
function openCloneConfigModal() {
    const modal = document.getElementById('cloneConfigModal');
    if (modal) {
        // Populate namespace options
        populateNamespaceOptions();
        modal.style.display = 'block';
    }
}

// Close clone config modal
function closeCloneConfigModal() {
    const modal = document.getElementById('cloneConfigModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear error message
        document.getElementById('cloneError').style.display = 'none';
    }
}

// Populate namespace options in clone modal
async function populateNamespaceOptions() {
    try {
        const response = await fetch(`${API_BASE}/namespaces`, {
            headers: getHeaders()
        });
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) {
            throw new Error('Failed to load namespaces');
        }
        const namespaces = await response.json();
        
        // Populate source and target namespace selectors
        const sourceSelect = document.getElementById('sourceNamespace');
        const targetSelect = document.getElementById('targetNamespace');
        
        if (sourceSelect && targetSelect) {
            // Clear existing options and event listeners
            sourceSelect.innerHTML = '';
            targetSelect.innerHTML = '';
            
            // Remove existing event listeners to prevent duplicates
            sourceSelect.replaceWith(sourceSelect.cloneNode(true));
            targetSelect.replaceWith(targetSelect.cloneNode(true));
            
            // Re-get the elements after cloning
            const newSourceSelect = document.getElementById('sourceNamespace');
            const newTargetSelect = document.getElementById('targetNamespace');
            
            // Add namespaces as options
            namespaces.forEach(ns => {
                // Source namespace option
                const sourceOption = document.createElement('option');
                sourceOption.value = ns;
                sourceOption.textContent = ns;
                newSourceSelect.appendChild(sourceOption);
                
                // Target namespace option
                const targetOption = document.createElement('option');
                targetOption.value = ns;
                targetOption.textContent = ns;
                newTargetSelect.appendChild(targetOption);
            });
            
            // Set current namespace as source by default
            const currentNamespace = document.getElementById('namespace').value;
            if (namespaces.includes(currentNamespace)) {
                newSourceSelect.value = currentNamespace;
                // Select a different target namespace if available
                if (namespaces.length > 1) {
                    const otherNamespaces = namespaces.filter(ns => ns !== currentNamespace);
                    newTargetSelect.value = otherNamespaces[0];
                }
            }
            
            // Add event listeners
            newSourceSelect.addEventListener('change', loadSourceConfigs);
            newTargetSelect.addEventListener('change', validateNamespaces);
            
            // Load configs for default source namespace
            loadSourceConfigs();
            validateNamespaces();
        }
    } catch (error) {
        console.error(error);
        showNotification('Error loading namespaces: ' + error.message, 'error');
    }
}

// Validate that source and target namespaces are different
function validateNamespaces() {
    const sourceNamespace = document.getElementById('sourceNamespace').value;
    const targetNamespace = document.getElementById('targetNamespace').value;
    const cloneError = document.getElementById('cloneError');
    
    if (sourceNamespace === targetNamespace) {
        cloneError.textContent = 'Source and target namespaces must be different';
        cloneError.style.display = 'block';
    } else {
        cloneError.style.display = 'none';
    }
}

// Load source configs when source namespace changes
async function loadSourceConfigs() {
    const sourceNamespace = document.getElementById('sourceNamespace').value;
    const groupInput = document.getElementById('cloneGroup');
    const configSelectionList = document.getElementById('configSelectionList');
    
    // Ensure group has a default value
    if (!groupInput.value) {
        groupInput.value = 'DEFAULT_GROUP';
    }
    
    const group = groupInput.value;
    
    if (!sourceNamespace || !group) {
        configSelectionList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Please select a source namespace and group</div>';
        return;
    }
    
    try {
        // Show loading state
        configSelectionList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;"><span class="loading"></span> Loading configs...</div>';
        
        console.log('Loading configs from:', `${API_BASE}/namespaces/${sourceNamespace}/groups/${group}/configs`);
        
        const response = await fetch(`${API_BASE}/namespaces/${sourceNamespace}/groups/${group}/configs`, {
            headers: getHeaders()
        });
        
        console.log('Response status:', response.status);
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to load source configs: ${errorText}`);
        }
        
        const configs = await response.json();
        
        console.log('Loaded configs:', configs);
        console.log('Configs type:', typeof configs);
        
        // Ensure configs is an array, even if server returns null
        let configsArray = [];
        if (Array.isArray(configs)) {
            configsArray = configs;
        } else if (configs === null || configs === undefined) {
            configsArray = [];
        } else {
            // If it's a single object, wrap it in an array
            configsArray = [configs];
        }
        
        console.log('Processed configs array:', configsArray);
        console.log('Configs array length:', configsArray.length);
        
        if (configsArray.length === 0) {
            configSelectionList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No configs found in source namespace</div>';
            return;
        }
        
        // Populate config selection list
        let html = '';
        configsArray.forEach((item, index) => {
            console.log(`Config ${index}:`, item);
            
            // Handle different data formats
            let configKey, configValue, configVersion;
            
            // Debug: Log all properties of the item
            if (item && typeof item === 'object') {
                console.log(`Item properties:`, Object.keys(item));
            }
            
            // Check if item is a Config object
            if (item && typeof item === 'object') {
                // Try different ways to get the key
                configKey = item.key || item.Key || `config_${index}`;
                configValue = item.value || item.Value || '';
                configVersion = item.version || item.Version || 1;
            } else if (typeof item === 'string') {
                // If item is a string, use it as key
                configKey = item;
                configValue = '';
                configVersion = 1;
            } else {
                // Default fallback
                configKey = `config_${index}`;
                configValue = '';
                configVersion = 1;
            }
            
            // Ensure configKey is not empty
            if (!configKey || configKey === '') {
                configKey = `config_${index}`;
            }
            
            html += `
                <div style="display: flex; align-items: center; padding: 12px 8px; border-bottom: 1px solid #f0f0f0; background: #fff;">
                    <input type="checkbox" name="configKeys" value="${configKey}" id="config_${configKey}" style="margin-right: 12px; flex-shrink: 0; width: 16px; height: 16px;">
                    <div style="flex: 1; min-width: 0; margin-right: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <label for="config_${configKey}" style="display: block; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; font-weight: 500; font-size: 14px;">${configKey}</label>
                            <span style="color: #666; font-size: 12px; margin-left: 8px; flex-shrink: 0;">v${configVersion}</span>
                        </div>
                        ${configValue ? `<div style="font-size: 12px; color: #666; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Value: ${configValue}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        configSelectionList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading source configs:', error);
        configSelectionList.innerHTML = `<div style="text-align: center; color: #ff4d4f; padding: 20px;">Error loading configs: ${error.message}</div>`;
    }
}

// Select all configs
function selectAllConfigs() {
    const checkboxes = document.querySelectorAll('input[name="configKeys"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

// Deselect all configs
function deselectAllConfigs() {
    const checkboxes = document.querySelectorAll('input[name="configKeys"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

// Clone configs from source to target namespace
async function cloneConfigs() {
    const sourceNamespace = document.getElementById('sourceNamespace').value;
    const targetNamespace = document.getElementById('targetNamespace').value;
    const group = document.getElementById('cloneGroup').value;
    const overwrite = document.getElementById('overwriteConfigs').checked;
    const cloneError = document.getElementById('cloneError');
    
    // Validation
    if (!sourceNamespace || !targetNamespace || !group) {
        cloneError.textContent = 'All fields are required';
        cloneError.style.display = 'block';
        return;
    }
    
    if (sourceNamespace === targetNamespace) {
        cloneError.textContent = 'Source and target namespaces must be different';
        cloneError.style.display = 'block';
        return;
    }
    
    // Get selected config keys
    const selectedCheckboxes = document.querySelectorAll('input[name="configKeys"]:checked');
    const selectedKeys = Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
    
    if (selectedKeys.length === 0) {
        cloneError.textContent = 'Please select at least one config to clone';
        cloneError.style.display = 'block';
        return;
    }
    
    // Hide error message if validation passes
    cloneError.style.display = 'none';
    
    // Show confirmation prompt
    const confirmMessage = `Are you sure you want to clone ${selectedKeys.length} config(s) from "${sourceNamespace}" to "${targetNamespace}"?`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const cloneBtn = event.target;
    const originalText = cloneBtn.innerHTML;
    cloneBtn.innerHTML = '<span class="loading"></span> Cloning...';
    cloneBtn.disabled = true;
    
    try {
        // Get source configs
        const sourceResponse = await fetch(`${API_BASE}/namespaces/${sourceNamespace}/groups/${group}/configs`, {
            headers: getHeaders()
        });
        
        if (sourceResponse.status === 401) {
            logout();
            return;
        }
        
        if (!sourceResponse.ok) {
            throw new Error('Failed to load source configs');
        }
        
        const sourceConfigs = await sourceResponse.json();
        
        // Filter source configs to only include selected keys
        const configsToClone = sourceConfigs.filter(config => selectedKeys.includes(config.key));
        
        if (configsToClone.length === 0) {
            showNotification('No selected configs found in source namespace', 'warning');
            closeCloneConfigModal();
            return;
        }
        
        // Clone each selected config to target namespace
        let successCount = 0;
        let errorCount = 0;
        
        for (const config of configsToClone) {
            try {
                const targetUrl = `${API_BASE}/namespaces/${targetNamespace}/groups/${group}/configs/${config.key}`;
                const method = overwrite ? 'PUT' : 'POST';
                
                const response = await fetch(targetUrl, {
                    method: method,
                    headers: getHeaders(),
                    body: JSON.stringify({ value: config.value })
                });
                
                if (response.status === 409 && !overwrite) {
                    // Config already exists and overwrite is not allowed
                    errorCount++;
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`Failed to clone config ${config.key}`);
                }
                
                successCount++;
            } catch (error) {
                console.error(`Error cloning config ${config.key}:`, error);
                errorCount++;
            }
        }
        
        // Show result notification
        if (successCount > 0) {
            showNotification(`Successfully cloned ${successCount} config(s). ${errorCount} config(s) failed.`, 'success');
        } else {
            showNotification(`Failed to clone any configs. ${errorCount} errors occurred.`, 'error');
        }
        
        // Close modal
        closeCloneConfigModal();
        
        // Reload current configs if target is current namespace
        const currentNamespace = document.getElementById('namespace').value;
        if (targetNamespace === currentNamespace) {
            loadConfigs();
        }
        
    } catch (error) {
        console.error('Error cloning configs:', error);
        showNotification('Error cloning configs: ' + error.message, 'error');
    } finally {
        // Restore button state
        cloneBtn.innerHTML = originalText;
        cloneBtn.disabled = false;
    }
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const configModal = document.getElementById('createConfigModal');
    if (e.target === configModal) {
        closeCreateConfigModal();
    }
    
    const namespaceModal = document.getElementById('createNamespaceModal');
    if (e.target === namespaceModal) {
        closeCreateNamespaceModal();
    }
    
    const cloneModal = document.getElementById('cloneConfigModal');
    if (e.target === cloneModal) {
        closeCloneConfigModal();
    }
});

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
});
