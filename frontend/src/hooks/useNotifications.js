import { useCallback, useEffect, useRef, useState } from "react";
import { getRequest, patchJson, postJson } from "../api/client";

const POLL_MS = 30000;
const PAGE_SIZE = 20;

export function timeAgo(value) {
  if (!value) return "";
  const iso = String(value).endsWith("Z") ? value : `${value}Z`;
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function useNotifications({ load = true, poll = true } = {}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(load);
  const [error, setError] = useState("");
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getRequest(`/notifications?page=1&limit=${PAGE_SIZE}`);
      if (!alive.current) return;
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
      setHasMore(!!data.hasMore);
      setPage(1);
      setError("");
    } catch (err) {
      if (alive.current) setError(err.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    try {
      const data = await getRequest(`/notifications?page=${next}&limit=${PAGE_SIZE}`);
      setItems((cur) => [...cur, ...(data.notifications || [])]);
      setHasMore(!!data.hasMore);
      setPage(next);
    } catch (err) {
      setError(err.message);
    }
  }, [page]);

  const markRead = useCallback(
    async (id) => {
      const target = items.find((n) => n.id === id);
      if (!target || target.read) return;
      setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await patchJson(`/notifications/${id}/read`, {});
      } catch {
        refresh();
      }
    },
    [items, refresh]
  );

  const markAllRead = useCallback(async () => {
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await postJson("/notifications/read-all", {});
    } catch (err) {
      setError(err.message);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    alive.current = true;
    if (load) refresh();
    if (!poll) {
      return () => {
        alive.current = false;
      };
    }
    const tick = () => {
      if (!document.hidden) refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load, poll, refresh]);

  return { items, unread, hasMore, loading, error, refresh, loadMore, markRead, markAllRead };
}
