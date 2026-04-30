import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 1. Authorization: Only admins can call this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const role = user.app_metadata?.role;
    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { op } = await req.json().catch(() => ({ op: "status" }));

    if (op === "backfill") {
      let page = 1;
      const perPage = 50;
      let totalProcessed = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) throw listError;
        if (users.length === 0) {
          hasMore = false;
          break;
        }

        for (const authUser of users) {
          const displayName = authUser.user_metadata?.full_name || 
                              authUser.user_metadata?.name || 
                              authUser.email?.split("@")[0] || 
                              "Usuário sem nome";

          const { error: upsertError } = await supabaseClient
            .from("rnc_contatos")
            .upsert({
              auth_user_id: authUser.id,
              email: authUser.email,
              display_name: displayName,
              source: "auth_sync",
              is_active: true,
            }, { onConflict: "auth_user_id" });

          if (upsertError) console.error(`Error upserting ${authUser.email}:`, upsertError);
          else totalProcessed++;
        }

        if (users.length < perPage) hasMore = false;
        else page++;
      }

      return new Response(JSON.stringify({ success: true, processed: totalProcessed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (op === "status") {
      const { count, error: countError } = await supabaseClient
        .from("rnc_contatos")
        .select("*", { count: "exact", head: true })
        .eq("source", "auth_sync");

      if (countError) throw countError;

      return new Response(JSON.stringify({ 
        source: "auth_sync",
        count: count,
        last_check: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid operation" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
