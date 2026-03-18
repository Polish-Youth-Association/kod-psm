"use client";

import { createContext, useContext } from "react";

export type Message = {
  id: string;
  role: "user" | "model";
  text: string;
};

type UserContextValue = {
  userEmail: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
};

export const UserContext = createContext<UserContextValue>({
  userEmail: null,
  messages: [],
  setMessages: () => {},
});

export function useUser() {
  return useContext(UserContext);
}
