import { FormEvent, useEffect, useMemo, useState } from "react";

type RoomParticipant = { id: string; nickname: string; videoUrl?: string; joinedAt: string };
type RoomMessage = { id: string; participantId: string; nickname: string; message: string; createdAt: string };
type RoomPayload = { room: string; participants: RoomParticipant[]; messages: RoomMessage[]; retentionHours: number };

function cleanRoom(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function makeRoom() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function roomReadPath(room: string) {
  return `/api/watch-room/${encodeURIComponent(room)}`;
}

async function readRoom(room: string): Promise<RoomPayload> {
  const response = await fetch(roomReadPath(room), { cache: "no-store" });
  const data = await response.json() as RoomPayload & { error?: string };
  if (!response.ok) throw new Error(data.error || "房间暂时没有打开。");
  return data;
}

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "刚刚" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function WatchRoom() {
  const initialRoom = useMemo(() => cleanRoom(new URLSearchParams(window.location.search).get("room") || ""), []);
  const [roomCode, setRoomCode] = useState(initialRoom);
  const [nickname, setNickname] = useState(() => sessionStorage.getItem("watch-room-nickname") || "");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!roomCode || !participantId) return undefined;
    let active = true;
    const pull = async () => {
      try {
        const latest = await readRoom(roomCode);
        if (active) setRoom(latest);
      } catch {
        if (active) setNotice("房间暂时没有回应；聊天记录会在重新接通后回来。");
      }
    };
    void pull();
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void pull(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomCode, participantId]);

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRoom = cleanRoom(roomCode);
    const nextNickname = nickname.trim().slice(0, 40);
    if (nextRoom.length < 4 || !nextNickname) return setNotice("请留下房间码和昵称。");
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/watch-room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", room: nextRoom, nickname: nextNickname, videoUrl }) });
      const data = await response.json() as RoomPayload & { participantId?: string; error?: string };
      if (!response.ok || !data.participantId) throw new Error(data.error || "房间暂时没有打开。");
      setRoomCode(nextRoom);
      setParticipantId(data.participantId);
      setRoom(data);
      sessionStorage.setItem("watch-room-nickname", nextNickname);
      window.history.replaceState({}, "", `/watch-room/?room=${encodeURIComponent(nextRoom)}`);
      setNotice("已经进入这个房间。视频仍从每个人留下的外部链接打开。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "房间暂时没有打开。");
    } finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = message.trim();
    if (!value || !roomCode || !participantId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/watch-room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "message", room: roomCode, participantId, message: value }) });
      const data = await response.json() as RoomPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "这句话暂时没有留下。");
      setRoom(data);
      setMessage("");
      setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "这句话暂时没有留下。"); }
    finally { setBusy(false); }
  }

  async function leave() {
    if (!roomCode || !participantId) return;
    setBusy(true);
    try { await fetch("/api/watch-room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "leave", room: roomCode, participantId }) }); }
    finally { setRoom(null); setParticipantId(""); setMessage(""); setNotice("已经离开这个临时房间。"); setBusy(false); }
  }

  async function copyInvite() {
    const url = `${window.location.origin}/watch-room/?room=${encodeURIComponent(roomCode)}`;
    try { await navigator.clipboard.writeText(url); setNotice("房间入口已经复制。"); }
    catch { setNotice(url); }
  }

  return <main className="watch-room-shell">
    <header className="watch-room-header"><a href="/" className="watch-room-back">↖ 返回 300条痕迹</a><span>临时房间 · {roomCode || "尚未进入"}</span></header>
    <section className="watch-room-intro"><p className="eyebrow">另一个入口</p><h1>同步观影，<em>在场</em>说话。</h1><p>这是一个与作品分开的临时聊天室。每个人可以留下自己的视频外链，聊天以短轮询同步；网站不托管或转码视频。</p></section>
    {!room ? <form className="watch-room-entry" onSubmit={enter}><div className="watch-room-entry-heading"><div><p className="eyebrow">进入一间房</p><h2>把入口交给同行的人。</h2></div><button className="watch-room-quiet-button" type="button" onClick={() => setRoomCode(makeRoom())}>随机开一间</button></div><label>房间码<input required value={roomCode} onChange={(event) => setRoomCode(cleanRoom(event.target.value))} placeholder="例如 SEA2026" maxLength={12} /></label><label>昵称<input required value={nickname} onChange={(event) => setNickname(event.target.value.slice(0, 40))} placeholder="可以不是真名" maxLength={40} /></label><label>我的视频链接（选填）<input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://…" maxLength={500} /></label><button className="watch-room-submit" type="submit" disabled={busy}>{busy ? "正在进入…" : "进入房间"} <span aria-hidden="true">↗</span></button></form> : <section className="watch-room-active"><div className="watch-room-active-head"><div><p className="eyebrow">正在一起</p><h2>房间 {room.room}</h2></div><div className="watch-room-active-actions"><button className="watch-room-quiet-button" type="button" onClick={() => void copyInvite()}>复制入口</button><button className="watch-room-quiet-button" type="button" onClick={() => void leave()} disabled={busy}>离开</button></div></div><div className="watch-room-grid"><aside className="watch-room-people"><p className="watch-room-label">在场的人 · {room.participants.length}</p>{room.participants.length ? <ul>{room.participants.map((person) => <li key={person.id}><span>{person.nickname}</span>{person.videoUrl && <a href={person.videoUrl} target="_blank" rel="noreferrer">打开视频 ↗</a>}</li>)}</ul> : <p className="watch-room-empty">还没有人留下视频入口。</p>}<p className="watch-room-retention">消息会在约 {room.retentionHours} 小时后清理；参与者长时间离开后会从房间中消失。</p></aside><div className="watch-room-chat"><div className="watch-room-messages" aria-live="polite">{room.messages.length ? room.messages.map((item) => <article className={item.participantId === participantId ? "is-me" : ""} key={item.id}><header><strong>{item.nickname}</strong><time>{timeLabel(item.createdAt)}</time></header><p>{item.message}</p></article>) : <p className="watch-room-empty">还没有话。可以从正在看的画面说起。</p>}</div><form className="watch-room-message-form" onSubmit={sendMessage}><input aria-label="写一句话" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 280))} placeholder="写下一句话…" maxLength={280} /><button className="watch-room-submit" type="submit" disabled={busy || !message.trim()}>留下</button></form></div></div></section>}
    {notice && <p className="watch-room-notice" role="status">{notice}</p>}
    <footer className="watch-room-footer"><span>视频在外部平台，房间只保存入口与短消息。</span><span>这是独立功能，不进入《300条痕迹》作品档案。</span></footer>
  </main>;
}
