import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canViewReport, getUserAccess } from "@/lib/auth/access";
import { isAdminPath, reportForPath } from "@/lib/reports";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api/");

  if (!user && !isAuthRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Permisos por informe: solo se consultan en rutas de informes o de administración.
  const report = user ? reportForPath(pathname) : undefined;
  const needsAdmin = Boolean(user) && isAdminPath(pathname);
  if (user && (report || needsAdmin)) {
    let allowed = false;
    try {
      const access = await getUserAccess(supabase, user.email ?? "");
      allowed = needsAdmin ? access.isAdmin : canViewReport(access, report!.slug);
    } catch (error) {
      console.error("No fue posible verificar los permisos del usuario", error);
    }
    if (!allowed) {
      console.warn(`Acceso denegado a ${pathname}`);
      if (isApiRoute) {
        return NextResponse.json({ error: "No tienes acceso a este informe." }, { status: 403 });
      }
      const portalUrl = new URL("/", request.url);
      portalUrl.searchParams.set("acceso", "denegado");
      return NextResponse.redirect(portalUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
