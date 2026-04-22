# Authenticated API Client

Automatically includes Firebase token in all API requests to the backend.

## Setup

1. **Already configured!** ✅
   - Vite proxy: `/api/v1` → `http://localhost:8000`
   - Firebase auth initialized in your app

## Usage

### Simple GET Request

```typescript
import { api } from '@/lib/api';

// Old way (NO TOKEN ❌)
const data = await fetch('/api/v1/case/123/workflows').then(r => r.json());

// New way (WITH TOKEN ✅)
const data = await api.get('/api/v1/case/123/workflows');
```

### POST Request

```typescript
import { api } from '@/lib/api';

const result = await api.post('/api/v1/case/start', {
  files: [{ url: 'https://...', filename: 'doc.pdf' }],
  extraction_schemas: ['W2']
});
```

### PUT Request

```typescript
const updated = await api.put(`/api/v1/case/${caseId}`, {
  case_name: 'New Name'
});
```

### Custom Request

```typescript
import { apiRequest } from '@/lib/api';

const data = await apiRequest('/api/v1/custom-endpoint', {
  method: 'POST',
  headers: {
    'X-Custom-Header': 'value'
  },
  body: JSON.stringify({ data: 'value' })
});
```

### File Upload

```typescript
import { uploadFile } from '@/lib/api';

const formData = new FormData();
formData.append('file', fileBlob, 'document.pdf');
formData.append('extraction_schemas', JSON.stringify(['W2', 'Paystub']));

const result = await uploadFile('/api/v1/case/upload', formData);
```

### SSE Streaming (Server-Sent Events)

```typescript
import { createEventSource } from '@/lib/api';

const eventSource = await createEventSource(`/api/v1/stream/${caseId}`);

eventSource.addEventListener('page_result', (event) => {
  const data = JSON.parse(event.data);
  console.log('Page result:', data);
  setResults(prev => [...prev, data]);
});

eventSource.addEventListener('complete', () => {
  eventSource.close();
});

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};

// Cleanup
return () => eventSource.close();
```

## Error Handling

```typescript
import { api, APIError } from '@/lib/api';

try {
  const data = await api.get('/api/v1/case/123/status');
  return data;
} catch (error) {
  if (error instanceof APIError) {
    // API error with status code
    if (error.status === 403) {
      console.error('Not authorized:', error.message);
      // Redirect to login
      window.location.href = '/login';
    } else if (error.status === 404) {
      console.error('Not found:', error.message);
    } else {
      console.error('API error:', error.message, error.data);
    }
  } else {
    // Network error or other
    console.error('Request failed:', error);
  }
}
```

## React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

function useCaseWorkflows(caseId: string) {
  const [workflows, setWorkflows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorkflows() {
      try {
        setLoading(true);
        const data = await api.get(`/api/v1/case/${caseId}/workflows`);

        if (!cancelled) {
          setWorkflows(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchWorkflows();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return { workflows, loading, error };
}

// Usage in component
function WorkflowsView({ caseId }: { caseId: string }) {
  const { workflows, loading, error } = useCaseWorkflows(caseId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render workflows */}</div>;
}
```

## React Query Example (Recommended)

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Query
function useCaseStatus(caseId: string) {
  return useQuery({
    queryKey: ['case', caseId, 'status'],
    queryFn: () => api.get(`/api/v1/case/${caseId}/status`),
    refetchInterval: 2000, // Poll every 2s
  });
}

// Mutation
function useStartCase() {
  return useMutation({
    mutationFn: (data: StartCaseRequest) =>
      api.post('/api/v1/case/start', data),
    onSuccess: (result) => {
      console.log('Case started:', result.case_id);
    },
  });
}

// Usage
function CaseView({ caseId }: { caseId: string }) {
  const { data: status, isLoading } = useCaseStatus(caseId);
  const startCase = useStartCase();

  // Token is automatically included! ✅
}
```

## Migration Guide

### Find & Replace

Search for:
```typescript
fetch('/api/v1/
```

Replace with:
```typescript
api.get('/api/v1/
// or api.post('/api/v1/ for POST requests
```

### Before (❌ No Token)

```typescript
const response = await fetch(`/api/v1/case/${caseId}/workflows`);
const data = await response.json();
```

### After (✅ With Token)

```typescript
const data = await api.get(`/api/v1/case/${caseId}/workflows`);
```

## How It Works

1. **Gets Firebase token** - Calls `user.getIdToken()` automatically
2. **Adds Authorization header** - `Authorization: Bearer <token>`
3. **Makes request** - Proxied by Vite to backend (port 8000)
4. **Backend verifies token** - Firebase middleware validates it
5. **Returns response** - Or throws `APIError` with status code

## Token Refresh

Firebase SDK automatically refreshes tokens before they expire. The `getIdToken()` call returns a fresh token every time, so you don't need to handle token refresh manually! 🎉

## What Changed?

| Before | After |
|--------|-------|
| ❌ No token in request | ✅ Token automatically added |
| ❌ Manual fetch calls | ✅ Simple `api.get()` |
| ❌ Manual error handling | ✅ Typed `APIError` |
| ❌ Verbose code | ✅ Clean, concise |
| ❌ Easy to forget token | ✅ Impossible to forget! |

## Protected Routes

Make sure your app has route protection:

```typescript
// src/App.tsx or router config
import { useAuth } from './hooks/useAuth';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

// Usage
<Route
  path="/case/:id"
  element={
    <ProtectedRoute>
      <CaseView />
    </ProtectedRoute>
  }
/>
```

Now all your API calls will automatically include the Firebase token! 🚀
