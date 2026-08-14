import { ConnectionCheck } from "@/components/connection-check";
import { adminDb, hasSupabaseEnv } from "@/lib/supabase";
import { EmptyState, PageHeader, SectionHeader } from "@/components/ui";

export default async function Settings() {
  const configured = hasSupabaseEnv();
  const { data: repository } = configured
    ? await adminDb().from("repositories").select("*,project:projects!repositories_project_id_fkey(name,notion_data_source_id)").limit(1).maybeSingle()
    : { data: null };
  const project = Array.isArray(repository?.project) ? repository.project[0] : repository?.project;

  return <>
    <PageHeader eyebrow="系統" title="設定" description="確認 Notion、GitHub、Supabase 與本機 Repository 的連線狀態。" />
    <section className="section card">
      <SectionHeader title="Repository 設定" description="這些值由 Supabase 管理，密鑰不會傳送到瀏覽器。" />
      {repository ? <div className="form">
        <ReadOnlyField label="專案" value={project?.name} />
        <ReadOnlyField label="Notion Data Source ID" value={project?.notion_data_source_id} />
        <ReadOnlyField label="GitHub Repository" value={`${repository.github_owner}/${repository.github_name}`} />
        <ReadOnlyField label="預設分支" value={repository.default_branch} />
        <ReadOnlyField label="本機 Repository 路徑" value={repository.local_path} />
        <ReadOnlyField label="安裝指令" value={repository.install_command} />
        <ReadOnlyField label="Lint 指令" value={repository.lint_command} />
        <ReadOnlyField label="型別檢查指令" value={repository.typecheck_command} />
        <ReadOnlyField label="測試指令" value={repository.test_command} />
      </div> : <EmptyState title="尚未建立 Repository 設定" description="請先執行 Supabase migration 與 seed。" />}
    </section>
    <ConnectionCheck disabled={!repository} />
  </>;
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return <label>{label}<input className="input" value={value || "未設定"} readOnly /></label>;
}
