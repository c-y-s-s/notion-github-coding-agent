create extension if not exists vector with schema extensions;

create table repository_embeddings (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references repositories(id) on delete cascade,
  commit_sha text not null,
  path text not null,
  content_hash text not null,
  content_excerpt text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  unique(repository_id, commit_sha, path)
);

create index repository_embeddings_lookup_idx on repository_embeddings(repository_id, commit_sha);
alter table repository_embeddings enable row level security;

create or replace function match_repository_embeddings(
  repository_uuid uuid,
  repository_commit text,
  query_embedding extensions.vector(1536),
  match_count integer default 20
)
returns table(path text, content_excerpt text, similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select re.path, re.content_excerpt, 1 - (re.embedding <=> query_embedding) as similarity
  from repository_embeddings re
  where re.repository_id = repository_uuid and re.commit_sha = repository_commit
  order by re.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;
