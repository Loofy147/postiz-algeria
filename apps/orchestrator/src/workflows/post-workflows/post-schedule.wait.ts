export type ScheduledPost = {
  state: string;
  publishDate: Date | string | number;
};

type WaitUntilPostScheduledOptions<Post extends ScheduledPost> = {
  loadPost: () => Promise<Post | null>;
  isPoked: () => boolean;
  consumePoke: () => void;
  waitForPoke: (timeoutMs: number) => Promise<boolean>;
  now?: () => number;
};

/**
 * Wait until the persisted post is due, reloading it whenever a schedule/state
 * signal arrives. Return null when the post was deleted or is no longer queued.
 *
 * The timer/signal primitive is injected so the same state machine can be
 * deterministically tested outside the Temporal workflow runtime.
 */
export async function waitUntilPostScheduled<Post extends ScheduledPost>({
  loadPost,
  isPoked,
  consumePoke,
  waitForPoke,
  now = Date.now,
}: WaitUntilPostScheduledOptions<Post>): Promise<Post | null> {
  let post = await loadPost();

  while (post) {
    if (post.state !== 'QUEUE') {
      return null;
    }

    if (isPoked()) {
      consumePoke();
      post = await loadPost();
      continue;
    }

    const remainingMs = new Date(post.publishDate).getTime() - now();
    if (remainingMs <= 0) {
      return post;
    }

    const wasPoked = await waitForPoke(remainingMs);
    if (!wasPoked) {
      return post;
    }

    consumePoke();
    post = await loadPost();
  }

  return null;
}
