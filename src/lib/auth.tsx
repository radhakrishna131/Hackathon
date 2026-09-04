import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "admin" | "trainer" | "trainee";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise < void > ;
  signOut: () => Promise < void > ;
};

const AuthContext = createContext < AuthState | null > (null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState < Session | null > (null);
  const [profile, setProfile] = useState < Profile | null > (null);
  const [role, setRole] = useState < AppRole | null > (null);
  const [loading, setLoading] = useState(true);
  
  const load = async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setRole(null);
      return;
    }
    
    try {
      const [profileResponse, rolesResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      
      if (profileResponse.error) console.error("Error loading profile:", profileResponse.error);
      if (rolesResponse.error) console.error("Error loading roles:", rolesResponse.error);
      
      setProfile((profileResponse.data as Profile) ?? null);
      
      const roles = (rolesResponse.data ?? []).map((x) => x.role as AppRole);
      
      setRole(
        roles.includes("admin") ?
        "admin" :
        roles.includes("trainer") ?
        "trainer" :
        roles.includes("trainee") ?
        "trainee" :
        null,
      );
    } catch (error) {
      console.error("Unexpected error loading user data:", error);
    }
  };
  
  useEffect(() => {
    let mounted = true;
    
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;
      if (error) console.error("Error getting session:", error);
      
      setSession(session);
      await load(session?.user.id);
      setLoading(false);
    });
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      
      setSession(currentSession);
      
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRole(null);
      } else if (currentSession?.user.id) {
        await load(currentSession.user.id);
      }
    });
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  const value: AuthState = {
    user: session?.user ?? null,
    session,
    profile,
    role,
    loading,
    refresh: async () => {
      if (session?.user.id) await load(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setRole(null);
      setSession(null);
    },
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
