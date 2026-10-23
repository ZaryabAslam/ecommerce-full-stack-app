"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function SignOut() { const router=useRouter();return <button className="button button-secondary" onClick={async()=>{const supabase=createClient();await supabase.auth.signOut();router.push("/");router.refresh();}}>Sign out</button>; }
