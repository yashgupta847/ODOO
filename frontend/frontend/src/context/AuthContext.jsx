
import { createContext, useContext, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("session");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", {
      email,
      password,
    });

    if (data.session) {
      localStorage.setItem("session", JSON.stringify(data.session));
      setSession(data.session);
    }

    return data;
  };

  const register = async (full_name, email, password) => {
    const { data } = await api.post("/auth/register", {
      full_name,
      email,
      password,
    });

    if (data.session) {
      localStorage.setItem("session", JSON.stringify(data.session));
      setSession(data.session);
    }

    return data;
  };

  const logout = () => {
    localStorage.removeItem("session");
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
