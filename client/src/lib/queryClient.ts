import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Create and export the query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const responseText = await res.text();
      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new Error(responseText || `${res.status}: ${res.statusText}`);
      }
      throw new Error(json.message || `${res.status}: ${res.statusText}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export const apiRequest: QueryFunction = async ({ queryKey, meta }) => {
  const [url, options = {}] = queryKey as [string, RequestInit?];
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  });

  await throwIfResNotOk(response);

  // Global 401 interceptor
  if (response.status === 401) {
    // Clear all cached data and invalidate auth queries
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }

  return response.json();
};

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return await res.json();
  };
