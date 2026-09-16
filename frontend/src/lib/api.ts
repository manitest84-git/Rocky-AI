import { API_URL, getApiUrl } from './constants';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface HealthStatus {
  status: string;
  version: string;
}

export interface TokenResponse {
  token: string;
}

export function getAuthHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jarvis_auth_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Authenticate user and receive JWT token
 */
export async function loginUser(username: string, password: string): Promise<any> {
  const response = await fetch(`${getApiUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await response.json();
  if (typeof window !== 'undefined') {
    localStorage.setItem('jarvis_auth_token', data.access_token);
    localStorage.setItem('jarvis_user', JSON.stringify(data.user));
  }
  return data;
}

/**
 * Fetch all users (admin only)
 */
export async function getAdminUsers(): Promise<any[]> {
  const response = await fetch(`${getApiUrl()}/api/admin/users`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch user list');
  return response.json();
}

/**
 * Create a new user account (admin only)
 */
export async function createAdminUser(username: string, password: string, role: string = 'user'): Promise<any> {
  const response = await fetch(`${getApiUrl()}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ username, password, role })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to create user' }));
    throw new Error(err.detail || 'Failed to create user');
  }
  return response.json();
}

/**
 * Delete a user account (admin only)
 */
export async function deleteAdminUser(userId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to delete user');
}

/**
 * Reset a user's password (admin only)
 */
export async function resetUserPassword(userId: number, newPassword: string): Promise<any> {
  const response = await fetch(`${getApiUrl()}/api/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ new_password: newPassword })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to reset password' }));
    throw new Error(err.detail || 'Failed to reset password');
  }
  return response.json();
}

export async function getToken(roomName?: string, participantName?: string): Promise<string> {
  const safeRoom = typeof roomName === 'string' && roomName ? roomName : `jarvis-session-${Date.now()}`;
  const safeUser = typeof participantName === 'string' && participantName ? participantName : `user-${Math.floor(Math.random() * 10000)}`;

  const url = `${getApiUrl()}/api/token`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ room_name: safeRoom, participant_name: safeUser }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('jarvis_auth_token');
          localStorage.removeItem('jarvis_user');
        }
        throw new Error("Session expired. Please log in again.");
      }
      throw new Error(`Server returned status ${response.status}`);
    }

    const data: TokenResponse = await response.json();
    return data.token;
  } catch (err: any) {
    console.error(`getToken error connecting to ${url}:`, err);
    throw new Error(err.message || `Failed to connect to backend at ${url}. Ensure port 8333 is open and accessible.`);
  }
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  try {
    const response = await fetch(`${getApiUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      onToken("Connection error: Unable to reach backend.");
      onDone();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onToken("Error: Response stream empty.");
      onDone();
      return;
    }

    const decoder = new TextDecoder('utf-8');

    try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]' || dataStr === '{}') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.content) {
                  onToken(parsed.content);
                }
              } catch (e) {
                // Ignore partial JSON
              }
            }
          }
        }
    } finally {
      onDone();
      reader.releaseLock();
    }
  } catch (err: any) {
    console.warn("streamChat fetch exception:", err);
    onToken("Network error: Please verify authorization & connectivity.");
    onDone();
  }
}

export interface PaginatedHistoryResponse {
  messages: ChatMessage[];
  total_count: number;
  has_more: boolean;
  offset: number;
  limit: number;
}

export async function getUserHistory(limit: number = 10, offset: number = 0): Promise<PaginatedHistoryResponse> {
  try {
    const response = await fetch(`${getApiUrl()}/api/history?limit=${limit}&offset=${offset}`, {
      headers: { ...getAuthHeader() }
    });
    if (!response.ok) return { messages: [], total_count: 0, has_more: false, offset, limit };
    return await response.json();
  } catch (err) {
    console.warn("getUserHistory fetch error:", err);
    return { messages: [], total_count: 0, has_more: false, offset, limit };
  }
}

export async function clearUserHistory(): Promise<void> {
  try {
    await fetch(`${getApiUrl()}/api/history`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
  } catch (err) {
    console.warn("clearUserHistory fetch error:", err);
  }
}

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${getApiUrl()}/api/health`);
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  completed: boolean;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

/**
 * Fetch authenticated user's task list
 */
export async function getTasks(): Promise<Task[]> {
  const response = await fetch(`${getApiUrl()}/api/tasks`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch tasks');
  return response.json();
}

/**
 * Create a new task
 */
export async function createTask(task: { title: string; description?: string; due_date?: string; priority?: string }): Promise<Task> {
  const response = await fetch(`${getApiUrl()}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(task)
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
}

export async function toggleTask(taskId: number, completed: boolean): Promise<Task> {
  const response = await fetch(`${getApiUrl()}/api/tasks/${taskId}/toggle?completed=${completed}`, {
    method: 'PATCH',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to toggle task completion');
  return response.json();
}

export async function deleteTask(taskId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to delete task');
}

export async function getNotes(): Promise<Note[]> {
  const response = await fetch(`${getApiUrl()}/api/notes`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
}

export async function createNote(note: { title: string; content: string }): Promise<Note> {
  const response = await fetch(`${getApiUrl()}/api/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(note)
  });
  if (!response.ok) throw new Error('Failed to create note');
  return response.json();
}

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  attendees?: string[];
  agenda?: string;
  action_items?: any[];
  created_at: string;
}

/**
 * Fetch calendar events
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const response = await fetch(`${getApiUrl()}/api/calendar`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch calendar events');
  return response.json();
}

export async function createCalendarEvent(event: {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  location?: string;
  attendees?: string[];
  agenda?: string;
}): Promise<{ event: CalendarEvent; conflicts: any[] }> {
  const response = await fetch(`${getApiUrl()}/api/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error('Failed to create calendar event');
  return response.json();
}

export async function deleteCalendarEvent(eventId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/calendar/${eventId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to delete calendar event');
}

export async function generateMeetingAgenda(title: string, description?: string): Promise<string> {
  const response = await fetch(`${getApiUrl()}/api/calendar/generate-agenda`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ title, description })
  });
  if (!response.ok) throw new Error('Failed to generate agenda');
  const data = await response.json();
  return data.agenda;
}

export interface FinancialTransaction {
  id: number;
  type: 'expense' | 'income';
  category: string;
  amount: number;
  merchant?: string;
  transaction_date: string;
  notes?: string;
  created_at: string;
}

export interface FinanceSummary {
  total_income: number;
  total_expense: number;
  net_savings: number;
  category_breakdown: Record<string, number>;
}

export interface Subscription {
  id: number;
  service_name: string;
  billing_cycle: string;
  amount: number;
  next_billing_date: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface ShoppingItem {
  id: number;
  item_name: string;
  quantity: number;
  category: string;
  purchased: boolean;
  warranty_expiry?: string;
  created_at: string;
}

/**
 * Fetch financial transactions
 */
export async function getTransactions(): Promise<FinancialTransaction[]> {
  const response = await fetch(`${getApiUrl()}/api/finance/transactions`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
}

export async function createTransaction(tx: { type: string; category: string; amount: number; merchant?: string; transaction_date?: string; notes?: string }): Promise<FinancialTransaction> {
  const response = await fetch(`${getApiUrl()}/api/finance/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(tx)
  });
  if (!response.ok) throw new Error('Failed to log transaction');
  return response.json();
}

export async function deleteTransaction(txId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/finance/transactions/${txId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to delete transaction');
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const response = await fetch(`${getApiUrl()}/api/finance/summary`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch finance summary');
  return response.json();
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const response = await fetch(`${getApiUrl()}/api/finance/subscriptions`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch subscriptions');
  return response.json();
}

export async function createSubscription(sub: { service_name: string; amount: number; next_billing_date: string; billing_cycle?: string; category?: string }): Promise<Subscription> {
  const response = await fetch(`${getApiUrl()}/api/finance/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(sub)
  });
  if (!response.ok) throw new Error('Failed to create subscription tracker');
  return response.json();
}

export async function deleteSubscription(subId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/finance/subscriptions/${subId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to delete subscription');
}

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const response = await fetch(`${getApiUrl()}/api/shopping`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch shopping list');
  return response.json();
}

export async function createShoppingItem(item: { item_name: string; quantity?: number; category?: string; warranty_expiry?: string }): Promise<ShoppingItem> {
  const response = await fetch(`${getApiUrl()}/api/shopping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(item)
  });
  if (!response.ok) throw new Error('Failed to add shopping item');
  return response.json();
}

export async function toggleShoppingItem(itemId: number): Promise<ShoppingItem> {
  const response = await fetch(`${getApiUrl()}/api/shopping/${itemId}/toggle`, {
    method: 'PATCH',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to toggle shopping item');
  return response.json();
}

export async function deleteShoppingItem(itemId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/shopping/${itemId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to delete shopping item');
}

export interface VaultItem {
  id: number;
  user_id: number;
  data_category: string;
  encrypted_value: string;
  decrypted_value?: string;
  notes?: string;
  created_at: string;
}

export interface BackupItem {
  filename: string;
  size: number;
  created_at: string;
  age_days: number;
}

export interface BackupResponse {
  history: BackupItem[];
  liveness: {
    status: string;
    latest?: BackupItem;
    reason?: string;
  };
}

/**
 * Fetch and decrypt vault secrets
 */
export async function getVaultItems(): Promise<VaultItem[]> {
  const response = await fetch(`${getApiUrl()}/api/vault`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch vault items');
  return response.json();
}

export async function createVaultItem(category: string, secret_value: string, notes?: string): Promise<VaultItem> {
  const response = await fetch(`${getApiUrl()}/api/vault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ category, secret_value, notes })
  });
  if (!response.ok) throw new Error('Failed to store secret in vault');
  return response.json();
}

export async function deleteVaultItem(itemId: number): Promise<void> {
  const response = await fetch(`${getApiUrl()}/api/vault/${itemId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to purge vault item');
}

export async function getAdminBackups(): Promise<BackupResponse> {
  const response = await fetch(`${getApiUrl()}/api/admin/backups`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch backup history');
  return response.json();
}

export async function triggerAdminBackup(): Promise<any> {
  const response = await fetch(`${getApiUrl()}/api/admin/backup`, {
    method: 'POST',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to trigger database backup');
  return response.json();
}

// Proactive Alerts & Smart Home Interfaces & Endpoints (Sprint 5)
export interface ProactiveAlert {
  id: string;
  category: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
}

export interface SmartDevice {
  id: number;
  device_name: string;
  device_type: string;
  room: string;
  is_on: boolean;
  settings: Record<string, any>;
  updated_at: string;
}

export interface AutomationRoutine {
  id: number;
  routine_name: string;
  icon: string;
  description: string;
  actions: any[];
  created_at: string;
}

/**
 * Fetch proactive system alerts
 */
export async function getProactiveAlerts(): Promise<ProactiveAlert[]> {
  const response = await fetch(`${getApiUrl()}/api/proactive/alerts`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch proactive alerts');
  return response.json();
}

/**
 * Fetch IoT device states
 */
export async function getSmartHomeDevices(): Promise<SmartDevice[]> {
  const response = await fetch(`${getApiUrl()}/api/smart-home/devices`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch smart home devices');
  return response.json();
}

/**
 * Toggle or update IoT device
 */
export async function updateSmartHomeDevice(deviceId: number, is_on?: boolean, settings?: Record<string, any>): Promise<SmartDevice> {
  const response = await fetch(`${getApiUrl()}/api/smart-home/devices/${deviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ is_on, settings })
  });
  if (!response.ok) throw new Error('Failed to update smart home device');
  return response.json();
}

/**
 * Fetch automation macro routines
 */
export async function getAutomationRoutines(): Promise<AutomationRoutine[]> {
  const response = await fetch(`${getApiUrl()}/api/smart-home/routines`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to fetch automation routines');
  return response.json();
}

/**
 * Execute a one-touch macro routine
 */
export async function triggerAutomationRoutine(routineId: number): Promise<{ status: string; routine_name: string; actions_executed: number }> {
  const response = await fetch(`${getApiUrl()}/api/smart-home/routines/${routineId}/execute`, {
    method: 'POST',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) throw new Error('Failed to execute automation routine');
  return response.json();
}


