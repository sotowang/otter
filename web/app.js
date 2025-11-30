const API_BASE = '/api/v1';
let authToken = localStorage.getItem('otter_token');

// Check auth on load
if (authToken) {
    showMainContent();
    loadConfigs();
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error('Login failed');

        const data = await response.json();
        authToken = data.token;
        localStorage.setItem('otter_token', authToken);
        showMainContent();
        loadConfigs();
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('otter_token');
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
}

function showMainContent() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
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
        alert('Error loading configs: ' + error.message);
    }
}

function renderConfigs(configs) {
    const tbody = document.querySelector('#configTable tbody');
    tbody.innerHTML = '';

    configs.forEach(cfg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cfg.key}</td>
            <td>${cfg.value}</td>
            <td>${cfg.version}</td>
            <td class="actions">
                <button onclick="editConfig('${cfg.key}', '${escapeHtml(cfg.value)}')">Edit</button>
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

    if (!namespace || !group || !key) {
        alert('Namespace, Group and Key are required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ value })
        });

        if (!response.ok) {
            throw new Error('Failed to save config');
        }

        // Clear form
        document.getElementById('key').value = '';
        document.getElementById('value').value = '';

        // Reload list
        loadConfigs();
    } catch (error) {
        console.error(error);
        alert('Error saving config: ' + error.message);
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

        loadConfigs();
    } catch (error) {
        console.error(error);
        alert('Error deleting config: ' + error.message);
    }
}

async function showHistory(key) {
    const namespace = document.getElementById('namespace').value;
    const group = document.getElementById('group').value;

    document.getElementById('historyModal').style.display = 'block';
    document.getElementById('historyKey').innerText = key;

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}/history`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to load history');
        const histories = await response.json();
        renderHistory(histories || [], key);
    } catch (error) {
        console.error(error);
        alert('Error loading history: ' + error.message);
    }
}

function renderHistory(histories, key) {
    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '';

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

    try {
        const response = await fetch(`${API_BASE}/namespaces/${namespace}/groups/${group}/configs/${key}/rollback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ version: version })
        });

        if (!response.ok) throw new Error('Failed to rollback');

        alert('Rollback successful');
        closeHistory();
        loadConfigs();
    } catch (error) {
        console.error(error);
        alert('Error rolling back: ' + error.message);
    }
}

function editConfig(key, value) {
    document.getElementById('key').value = key;
    document.getElementById('value').value = value;
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
document.addEventListener('DOMContentLoaded', loadConfigs);
