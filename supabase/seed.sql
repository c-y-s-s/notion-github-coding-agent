with p as (insert into projects(name, notion_data_source_id) values ('Demo project', 'replace-with-notion-data-source-id') returning id),
r as (insert into repositories(project_id, github_owner, github_name, github_node_id, local_path, install_command, lint_command, typecheck_command, test_command)
select id, 'replace-owner', 'replace-repo', 'replace-node-id', '/absolute/path/to/repo', 'pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm typecheck', 'pnpm test' from p returning id, project_id)
update projects set default_repository_id = r.id from r where projects.id = r.project_id;

