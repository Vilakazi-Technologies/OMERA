export type MessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  mode: "chat" | "form";
};

export type FormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "id";
  required: boolean;
  value?: string;
  prompt: string;
};

export type FormSession = {
  id: string;
  fileName: string;
  fields: FormField[];
  currentIndex: number;
  languageId: string;
  /** Set when stored in Supabase */
  remoteId?: string;
};
