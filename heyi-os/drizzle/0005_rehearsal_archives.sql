CREATE TABLE rehearsal_archives (
 id text PRIMARY KEY NOT NULL,
 case_id text NOT NULL,
 payload text NOT NULL,
 created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
