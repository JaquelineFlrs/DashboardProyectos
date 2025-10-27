// Creates a Supabase client using global APP_CONFIG
window.supabase = window.supabase || {};
(function(){
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
    console.warn("Configura SUPABASE_URL y SUPABASE_ANON_KEY en APP_CONFIG.");
  }
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  async function refreshAuthUi(){
    const { data: { user } } = await sb.auth.getUser();
    const $st = $("#auth-status"), $out = $("#btn-logout");
    if(user){
      $st.text(`Conectado como ${user.email||user.id}`);
      $out.removeClass("hidden");
    }else{
      $st.text("No autenticado");
      $out.addClass("hidden");
    }
  }
  $(document).on("click", "#btn-logout", async () => { await sb.auth.signOut(); location.reload(); });
  $(refreshAuthUi);
})();
