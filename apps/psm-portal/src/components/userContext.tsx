"use client";

import { createContext, useContext } from "react";

type UserContextValue = { userEmail: string | null };

export const UserContext = createContext<UserContextValue>({ userEmail: null });

export function useUser() {
  return useContext(UserContext);
}
