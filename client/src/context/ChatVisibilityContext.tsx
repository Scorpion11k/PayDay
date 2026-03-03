import { createContext, useContext, useState, type ReactNode } from 'react';

interface ChatVisibilityContextType {
  isChatHidden: boolean;
  setChatHidden: (hidden: boolean) => void;
}

const ChatVisibilityContext = createContext<ChatVisibilityContextType>({
  isChatHidden: false,
  setChatHidden: () => {},
});

export function ChatVisibilityProvider({ children }: { children: ReactNode }) {
  const [isChatHidden, setChatHidden] = useState(false);
  return (
    <ChatVisibilityContext.Provider value={{ isChatHidden, setChatHidden }}>
      {children}
    </ChatVisibilityContext.Provider>
  );
}

export function useChatVisibility() {
  return useContext(ChatVisibilityContext);
}
