import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));
  }

  // Registra el ingreso para que los administradores vean a los usuarios pendientes de acceso.
  const email = data.user?.email?.trim().toLowerCase();
  if (email) {
    const fullName = data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? null;
    const { error: registerError } = await supabase
      .from("app_users")
      .upsert({ email, full_name: fullName, last_login_at: new Date().toISOString() }, { onConflict: "email" });
    if (registerError) console.error("No fue posible registrar el ingreso del usuario", registerError.message);
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
