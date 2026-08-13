drop function if exists match_repository_embeddings(uuid, text, extensions.vector, integer);
alter table repository_embeddings drop column if exists content_excerpt;

create or replace function match_repository_embeddings(
  repository_uuid uuid,
  repository_commit text,
  query_embedding extensions.vector(1536),
  match_count integer default 20
)
returns table(path text, similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select re.path, 1 - (re.embedding <=> query_embedding) as similarity
  from repository_embeddings re
  where re.repository_id = repository_uuid and re.commit_sha = repository_commit
  order by re.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;
