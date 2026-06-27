"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AgentConfig,
  Attachment,
  Conversation,
  Message,
  ProviderType,
  Session,
} from "./types";
import { api } from "./api";

interface AgentConfigInput {
  providerType: ProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
}

interface AppDataContextValue {
  session: Session | null;
  sessionLoaded: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;

  agentConfig: AgentConfig | null;
  saveAgentConfig: (input: AgentConfigInput) => Promise<void>;
  testAgentConnection: () => Promise<boolean>;
  fetchProviderModels: (input: {
    providerType: ProviderType;
    baseUrl: string;
    apiKey?: string;
  }) => Promise<string[]>;

  conversations: Conversation[];
  conversationsLoaded: boolean;
  messagesByConversation: Record<string, Message[]>;
  ensureMessagesLoaded: (conversationId: string) => void;
  createConversation: () => Promise<string>;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    attachments: Attachment[]
  ) => Promise<void>;
  uploadAttachment: (conversationId: string, file: File) => Promise<Attachment>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, Message[]>
  >({});

  const loadedConversationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    api
      .get<{ user: Session }>("/auth/me")
      .then((res) => setSession(res.user))
      .catch(() => setSession(null))
      .finally(() => setSessionLoaded(true));
  }, []);

  useEffect(() => {
    if (!session) return;
    api
      .get<{ agentConfig: AgentConfig | null }>("/agent-config")
      .then((res) => setAgentConfig(res.agentConfig))
      .catch(() => setAgentConfig(null));
    api
      .get<{ conversations: Conversation[] }>("/conversations")
      .then((res) => setConversations(res.conversations))
      .catch(() => setConversations([]))
      .finally(() => setConversationsLoaded(true));
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: Session }>("/auth/login", { email, password });
    setSession(res.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.post<{ user: Session }>("/auth/register", {
        name,
        email,
        password,
      });
      setSession(res.user);
    },
    []
  );

  const logout = useCallback(() => {
    setSession(null);
    setAgentConfig(null);
    setConversations([]);
    setConversationsLoaded(false);
    setMessagesByConversation({});
    loadedConversationIds.current = new Set();
    api.post("/auth/logout").catch(() => {});
  }, []);

  const saveAgentConfig = useCallback(async (input: AgentConfigInput) => {
    const res = await api.put<{ agentConfig: AgentConfig }>("/agent-config", input);
    setAgentConfig(res.agentConfig);
  }, []);

  const testAgentConnection = useCallback(async () => {
    const res = await api.post<{ success: boolean }>("/agent-config/test");
    setAgentConfig((prev) =>
      prev ? { ...prev, status: res.success ? "connected" : "error" } : prev
    );
    return res.success;
  }, []);

  const fetchProviderModels = useCallback(
    async (input: { providerType: ProviderType; baseUrl: string; apiKey?: string }) => {
      const res = await api.post<{ models: string[] }>("/agent-config/models", input);
      return res.models;
    },
    []
  );

  const createConversation = useCallback(async () => {
    const res = await api.post<{ conversation: Conversation }>("/conversations");
    setConversations((prev) => [res.conversation, ...prev]);
    setMessagesByConversation((prev) => ({ ...prev, [res.conversation.id]: [] }));
    loadedConversationIds.current.add(res.conversation.id);
    return res.conversation.id;
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    api.patch(`/conversations/${id}`, { title }).catch(() => {});
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesByConversation((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    api.delete(`/conversations/${id}`).catch(() => {});
  }, []);

  const ensureMessagesLoaded = useCallback((conversationId: string) => {
    if (loadedConversationIds.current.has(conversationId)) return;
    loadedConversationIds.current.add(conversationId);
    api
      .get<{ messages: Message[] }>(`/conversations/${conversationId}/messages`)
      .then((res) => {
        setMessagesByConversation((prev) => ({ ...prev, [conversationId]: res.messages }));
      })
      .catch(() => {
        loadedConversationIds.current.delete(conversationId);
      });
  }, []);

  const uploadAttachment = useCallback(
    async (conversationId: string, file: File) => {
      const res = await api.upload<{ attachment: Attachment }>(
        `/conversations/${conversationId}/attachments`,
        file
      );
      return res.attachment;
    },
    []
  );

  const sendMessage = useCallback(
    async (conversationId: string, content: string, attachments: Attachment[]) => {
      const res = await api.post<{ message: Message }>(
        `/conversations/${conversationId}/messages`,
        { content, attachmentIds: attachments.map((a) => a.id) }
      );
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), res.message],
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessageAt: res.message.createdAt,
                title: c.title === "New chat" ? content.slice(0, 60) : c.title,
              }
            : c
        )
      );
    },
    []
  );

  return (
    <AppDataContext.Provider
      value={{
        session,
        sessionLoaded,
        login,
        register,
        logout,
        agentConfig,
        saveAgentConfig,
        testAgentConnection,
        fetchProviderModels,
        conversations,
        conversationsLoaded,
        messagesByConversation,
        ensureMessagesLoaded,
        createConversation,
        renameConversation,
        deleteConversation,
        sendMessage,
        uploadAttachment,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
