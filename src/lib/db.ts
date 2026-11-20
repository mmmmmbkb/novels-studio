// ── طبقة البيانات: Supabase (حقيقي، متعدد المستخدمين) أو محلي (تجريبي) ──
// عند ضبط NEXT_PUBLIC_SUPABASE_URL + ANON_KEY يستخدم Supabase Auth وPostgres
// مع Row Level Security (انظر supabase/migrations/001_init.sql).
// بدونها يعمل التطبيق في «الوضع المحلي»: حسابات حقيقية منفصلة لكل مستخدم
// محفوظة في localStorage على جهاز المستخدم نفسه — للتجربة والتطوير فقط،
// وليست بديلًا عن السيرفر عند النشر العام.
import { getSupabase, ADMIN_EMAIL } from './supabase';
import type { Chapter, MembershipRequest, MembershipStatus, Novel, PointsEvent, PointsReason, Profile } from './types';
import { countWords, POINTS, wordsPoints } from './points';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`novels-studio::${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── الوضع المحلي (localStorage) ────────────────────────────────────────
interface LocalUser extends Profile { passwordHash: string; }
function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

class LocalDB {
  private users(): LocalUser[] { return read<LocalUser[]>('ns_users', []); }
  private saveUsers(u: LocalUser[]) { write('ns_users', u); }
  private novels(): Novel[] { return read<Novel[]>('ns_novels', []); }
  private chapters(): Chapter[] { return read<Chapter[]>('ns_chapters', []); }
  private events(): PointsEvent[] { return read<PointsEvent[]>('ns_points', []); }
  private requests(): MembershipRequest[] { return read<MembershipRequest[]>('ns_requests', []); }

  async signUp(email: string, password: string, name: string): Promise<Profile> {
    const users = this.users();
    const em = email.trim().toLowerCase();
    if (users.some((u) => u.email === em)) throw new Error('هذا الإيميل مسجّل بالفعل. جرّب تسجيل الدخول.');
    const isAdmin = users.length === 0 || em === ADMIN_EMAIL;
    const profile: LocalUser = {
      id: uid(), email: em, name: name.trim() || em.split('@')[0],
      membershipStatus: isAdmin ? 'approved' : 'none',
      role: isAdmin ? 'admin' : 'member', points: 0, createdAt: now(),
      passwordHash: await hashPassword(password),
    };
    users.push(profile); this.saveUsers(users);
    write('ns_session', { userId: profile.id });
    const { passwordHash: _h, ...pub } = profile; return pub;
  }
  async signIn(email: string, password: string): Promise<Profile> {
    const em = email.trim().toLowerCase();
    const user = this.users().find((u) => u.email === em);
    if (!user) throw new Error('لا يوجد حساب بهذا الإيميل.');
    if (user.passwordHash !== (await hashPassword(password))) throw new Error('كلمة المرور غير صحيحة.');
    write('ns_session', { userId: user.id });
    const { passwordHash: _h, ...pub } = user; return pub;
  }
  async signInWithFacebook(): Promise<void> {
    throw new Error('تسجيل الدخول بفيسبوك يحتاج ضبط Supabase + تطبيق فيسبوك (انظر README القسم 4). في الوضع المحلي استخدم الإيميل وكلمة المرور، ثم اربط بروفايل فيسبوك يدويًا من صفحة التحقق.');
  }
  async signOut() { if (typeof window !== 'undefined') localStorage.removeItem('ns_session'); }
  async getSession(): Promise<Profile | null> {
    const s = read<{ userId: string } | null>('ns_session', null);
    if (!s) return null;
    const user = this.users().find((u) => u.id === s.userId);
    if (!user) return null;
    const { passwordHash: _h, ...pub } = user; return pub;
  }
  async updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
    const users = this.users();
    const i = users.findIndex((u) => u.id === id); if (i < 0) throw new Error('المستخدم غير موجود');
    users[i] = { ...users[i], ...patch }; this.saveUsers(users);
    const { passwordHash: _h, ...pub } = users[i]; return pub;
  }
  async listNovels(userId: string): Promise<Novel[]> {
    return this.novels().filter((n) => n.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async createNovel(userId: string, data: Omit<Novel, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Novel> {
    const all = this.novels();
    const novel: Novel = { ...data, id: uid(), userId, createdAt: now(), updatedAt: now() };
    all.push(novel); write('ns_novels', all); return novel;
  }
  async updateNovel(id: string, patch: Partial<Novel>): Promise<void> {
    const all = this.novels(); const i = all.findIndex((n) => n.id === id); if (i < 0) return;
    all[i] = { ...all[i], ...patch, updatedAt: now() }; write('ns_novels', all);
  }
  async deleteNovel(id: string): Promise<void> {
    write('ns_novels', this.novels().filter((n) => n.id !== id));
    write('ns_chapters', this.chapters().filter((c) => c.novelId !== id));
  }
  async listChapters(novelId: string): Promise<Chapter[]> {
    return this.chapters().filter((c) => c.novelId === novelId).sort((a, b) => a.order - b.order);
  }
  async createChapter(userId: string, novelId: string, title: string): Promise<Chapter> {
    const all = this.chapters();
    const order = all.filter((c) => c.novelId === novelId).length + 1;
    const ch: Chapter = { id: uid(), novelId, userId, title, content: '', order, wordCount: 0, published: false, createdAt: now(), updatedAt: now() };
    all.push(ch); write('ns_chapters', all);
    await this.addPoints(userId, POINTS.CHAPTER_CREATED, 'chapter_created', `فصل جديد: ${title}`, ch.id, novelId);
    return ch;
  }
  async updateChapter(id: string, patch: Partial<Chapter>): Promise<Chapter> {
    const all = this.chapters(); const i = all.findIndex((c) => c.id === id); if (i < 0) throw new Error('الفصل غير موجود');
    const before = all[i];
    const content = patch.content ?? before.content;
    const wordCount = countWords(content);
    const prevWordsPts = wordsPoints(before.wordCount);
    const newWordsPts = wordsPoints(wordCount);
    all[i] = { ...before, ...patch, content, wordCount, updatedAt: now() };
    write('ns_chapters', all);
    if (newWordsPts > prevWordsPts) {
      await this.addPoints(before.userId, newWordsPts - prevWordsPts, 'words_milestone', `+${newWordsPts - prevWordsPts} نقاط — تجاوز ${wordCount} كلمة في «${all[i].title}»`, id, before.novelId);
    }
    return all[i];
  }
  async deleteChapter(id: string): Promise<void> { write('ns_chapters', this.chapters().filter((c) => c.id !== id)); }
  async publishChapter(chapterId: string, fbPostUrl?: string): Promise<Chapter> {
    const all = this.chapters(); const i = all.findIndex((c) => c.id === chapterId); if (i < 0) throw new Error('الفصل غير موجود');
    const already = all[i].published;
    all[i] = { ...all[i], published: true, fbPostUrl: fbPostUrl || all[i].fbPostUrl || null, updatedAt: now() };
    write('ns_chapters', all);
    if (!already) await this.addPoints(all[i].userId, POINTS.PUBLISH, 'published', `نشر فصل: ${all[i].title}`, chapterId, all[i].novelId);
    return all[i];
  }
  async syncEngagement(chapterId: string, reactions: number, comments: number): Promise<{ gained: number }> {
    const all = this.chapters(); const i = all.findIndex((c) => c.id === chapterId); if (i < 0) throw new Error('الفصل غير موجود');
    const ch = all[i];
    const newR = Math.max(0, reactions - (ch.lastSyncedReactions || 0));
    const newC = Math.max(0, comments - (ch.lastSyncedComments || 0));
    const gained = newR * POINTS.REACTION + newC * POINTS.COMMENT;
    all[i] = { ...ch, lastSyncedReactions: reactions, lastSyncedComments: comments, updatedAt: now() };
    write('ns_chapters', all);
    if (newR > 0) await this.addPoints(ch.userId, newR * POINTS.REACTION, 'reaction', `+${newR} تفاعل جديد على «${ch.title}»`, chapterId, ch.novelId);
    if (newC > 0) await this.addPoints(ch.userId, newC * POINTS.COMMENT, 'comment', `+${newC} تعليق جديد على «${ch.title}»`, chapterId, ch.novelId);
    return { gained };
  }
  async addPoints(userId: string, amount: number, reason: PointsReason, label: string, chapterId?: string | null, novelId?: string | null): Promise<void> {
    if (amount <= 0) return;
    const ev: PointsEvent = { id: uid(), userId, amount, reason, label, chapterId: chapterId || null, novelId: novelId || null, createdAt: now() };
    const all = this.events(); all.push(ev); write('ns_points', all);
    const users = this.users(); const u = users.find((x) => x.id === userId);
    if (u) { u.points += amount; this.saveUsers(users); }
  }
  async listPointsEvents(userId: string): Promise<PointsEvent[]> {
    return this.events().filter((e) => e.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  }
  async leaderboard(): Promise<{ name: string; points: number; novels: number; chapters: number }[]> {
    const users = this.users();
    return users.map((u) => ({
      name: u.name, points: u.points,
      novels: this.novels().filter((n) => n.userId === u.id).length,
      chapters: this.chapters().filter((c) => c.userId === u.id).length,
    })).sort((a, b) => b.points - a.points).slice(0, 20);
  }
  async requestMembership(profile: Profile, facebookUrl: string, note?: string): Promise<MembershipRequest> {
    const req: MembershipRequest = { id: uid(), userId: profile.id, userName: profile.name, userEmail: profile.email, facebookUrl, note: note || null, status: 'pending', createdAt: now() };
    const all = this.requests(); all.push(req); write('ns_requests', all);
    await this.updateProfile(profile.id, { facebookUrl, membershipStatus: 'pending' });
    return req;
  }
  async listMembershipRequests(): Promise<MembershipRequest[]> {
    return this.requests().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  /** نسخة الأدمن في الوضع المحلي: نفس القائمة (لا RLS محليًا). */
  async listMembershipRequestsAdmin(): Promise<MembershipRequest[]> {
    return this.listMembershipRequests();
  }
  async reviewMembership(id: string, approved: boolean, reviewer: string): Promise<void> {
    const all = this.requests(); const i = all.findIndex((r) => r.id === id); if (i < 0) return;
    all[i] = { ...all[i], status: approved ? 'approved' : 'rejected', reviewedBy: reviewer, reviewedAt: now() };
    write('ns_requests', all);
    await this.updateProfile(all[i].userId, { membershipStatus: approved ? 'approved' : 'rejected' });
  }
  /** نسخة الأدمن في الوضع المحلي: نفس المراجعة (لا RLS محليًا). */
  async reviewMembershipAdmin(id: string, approved: boolean, reviewer: string): Promise<void> {
    return this.reviewMembership(id, approved, reviewer);
  }
  async uploadCover(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
      r.readAsDataURL(file);
    });
  }
  // ── إدارة الأدمن (الوضع المحلي) ──
  async listAdminUsers(): Promise<Profile[]> {
    return this.users().map((u) => { const { passwordHash: _h, ...pub } = u; return pub; });
  }
  async setUserRole(email: string, role: 'admin' | 'member'): Promise<void> {
    const em = email.trim().toLowerCase();
    const users = this.users();
    const i = users.findIndex((u) => u.email === em);
    if (i < 0) throw new Error('لا يوجد حساب مسجّل بهذا الإيميل في الموقع');
    if (role === 'member' && em === ADMIN_EMAIL) throw new Error('لا يمكن إزالة دور الأدمن عن الأدمن الرئيسي');
    const me = await this.getSession();
    if (role === 'member' && me && me.email === em) throw new Error('لا يمكنك إزالة دور الأدمن عن نفسك');
    users[i] = { ...users[i], role, membershipStatus: role === 'admin' ? 'approved' : users[i].membershipStatus };
    this.saveUsers(users);
  }
  async claimAdminInvite(_code: string): Promise<void> {
    throw new Error('الدعوة السرية تعمل في وضع السيرفر فقط');
  }
}

// ── وضع Supabase (الحقيقي) ──────────────────────────────────────────────
// يطابق جداول supabase/migrations/001_init.sql. ملاحظة: كلمات المرور
// وحسابات فيسبوك تُدار بالكامل عبر Supabase Auth — لا نخزّنها أبدًا هنا.
function rowToProfile(r: Record<string, unknown>): Profile {
  return {
    id: String(r.id), email: String(r.email || ''), name: String(r.name || r.email || 'كاتب'),
    facebookId: (r.facebook_id as string) || null, facebookUrl: (r.facebook_url as string) || null,
    facebookName: (r.facebook_name as string) || null,
    membershipStatus: (r.membership_status as MembershipStatus) || 'none',
    role: (r.role as 'admin' | 'member') || 'member',
    points: Number(r.points || 0), createdAt: String(r.created_at || ''),
  };
}

class SupabaseDB {
  private sb() { const c = getSupabase(); if (!c) throw new Error('Supabase غير مضبوط'); return c; }
  async signUp(email: string, password: string, name: string): Promise<Profile> {
    const sb = this.sb();
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('تعذّر إنشاء الحساب');
    const { data: prof } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    if (prof) return rowToProfile(prof as Record<string, unknown>);
    return { id: data.user.id, email, name, membershipStatus: 'none', role: 'member', points: 0, createdAt: now() };
  }
  async signIn(email: string, password: string): Promise<Profile> {
    const sb = this.sb();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('تعذّر تسجيل الدخول');
    const p = await this.getSession(); if (!p) throw new Error('تعذّر قراءة الملف');
    return p;
  }
  async signInWithFacebook(): Promise<void> {
    const sb = this.sb();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/studio`, scopes: 'public_profile,email' },
    });
    if (error) throw new Error(error.message);
  }
  async signOut() { await this.sb().auth.signOut(); }
  async getSession(): Promise<Profile | null> {
    const sb = this.sb();
    const { data } = await sb.auth.getSession();
    const user = data.session?.user; if (!user) return null;
    const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!prof) return { id: user.id, email: user.email || '', name: (user.user_metadata?.name as string) || user.email || 'كاتب', membershipStatus: 'none', role: 'member', points: 0, createdAt: now() };
    return rowToProfile(prof as Record<string, unknown>);
  }
  async updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
    const sb = this.sb();
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.facebookUrl !== undefined) dbPatch.facebook_url = patch.facebookUrl;
    if (patch.facebookId !== undefined) dbPatch.facebook_id = patch.facebookId;
    if (patch.facebookName !== undefined) dbPatch.facebook_name = patch.facebookName;
    if (patch.membershipStatus !== undefined) dbPatch.membership_status = patch.membershipStatus;
    const { data, error } = await sb.from('profiles').update(dbPatch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return rowToProfile(data as Record<string, unknown>);
  }
  async listNovels(userId: string): Promise<Novel[]> {
    const { data, error } = await this.sb().from('novels').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => ({ id: String(r.id), userId: String(r.user_id), title: String(r.title), authorName: String(r.author_name), genre: String(r.genre || ''), description: String(r.description || ''), coverUrl: (r.cover_url as string) || null, coverColor: String(r.cover_color || '#b45309'), status: (r.status as Novel['status']) || 'draft', createdAt: String(r.created_at), updatedAt: String(r.updated_at) }));
  }
  async createNovel(userId: string, d: Omit<Novel, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Novel> {
    const { data, error } = await this.sb().from('novels').insert({ user_id: userId, title: d.title, author_name: d.authorName, genre: d.genre, description: d.description, cover_url: d.coverUrl || null, cover_color: d.coverColor, status: d.status }).select().single();
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    return { id: String(r.id), userId, title: String(r.title), authorName: String(r.author_name), genre: String(r.genre || ''), description: String(r.description || ''), coverUrl: (r.cover_url as string) || null, coverColor: String(r.cover_color || '#b45309'), status: (r.status as Novel['status']) || 'draft', createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
  }
  async updateNovel(id: string, patch: Partial<Novel>): Promise<void> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.genre !== undefined) dbPatch.genre = patch.genre;
    if (patch.coverUrl !== undefined) dbPatch.cover_url = patch.coverUrl;
    if (patch.coverColor !== undefined) dbPatch.cover_color = patch.coverColor;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    const { error } = await this.sb().from('novels').update(dbPatch).eq('id', id);
    if (error) throw new Error(error.message);
  }
  async deleteNovel(id: string): Promise<void> { const { error } = await this.sb().from('novels').delete().eq('id', id); if (error) throw new Error(error.message); }
  async listChapters(novelId: string): Promise<Chapter[]> {
    const { data, error } = await this.sb().from('chapters').select('*').eq('novel_id', novelId).order('order_index', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => ({ id: String(r.id), novelId: String(r.novel_id), userId: String(r.user_id), title: String(r.title), content: String(r.content || ''), order: Number(r.order_index || 0), wordCount: Number(r.word_count || 0), published: Boolean(r.published), fbPostUrl: (r.fb_post_url as string) || null, fbPostId: (r.fb_post_id as string) || null, lastSyncedReactions: Number(r.last_synced_reactions || 0), lastSyncedComments: Number(r.last_synced_comments || 0), createdAt: String(r.created_at), updatedAt: String(r.updated_at) }));
  }
  async createChapter(userId: string, novelId: string, title: string): Promise<Chapter> {
    const existing = await this.listChapters(novelId);
    const { data, error } = await this.sb().from('chapters').insert({ novel_id: novelId, user_id: userId, title, content: '', order_index: existing.length + 1, word_count: 0, published: false }).select().single();
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    await this.addPoints(userId, POINTS.CHAPTER_CREATED, 'chapter_created', `فصل جديد: ${title}`, String(r.id), novelId);
    return { id: String(r.id), novelId, userId, title, content: '', order: Number(r.order_index || 0), wordCount: 0, published: false, createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
  }
  async updateChapter(id: string, patch: Partial<Chapter>): Promise<Chapter> {
    const sb = this.sb();
    const { data: cur } = await sb.from('chapters').select('*').eq('id', id).single();
    const before = cur as Record<string, unknown> | null;
    const content = patch.content ?? String(before?.content || '');
    const wordCount = countWords(content);
    const delta = wordsPoints(wordCount) - wordsPoints(Number(before?.word_count || 0));
    const dbPatch: Record<string, unknown> = { word_count: wordCount, updated_at: new Date().toISOString() };
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.content !== undefined) dbPatch.content = patch.content;
    const { data, error } = await sb.from('chapters').update(dbPatch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    if (delta > 0 && before) await this.addPoints(String(before.user_id), delta, 'words_milestone', `+${delta} نقاط — تجاوز ${wordCount} كلمة`, id, String(before.novel_id));
    const r = data as Record<string, unknown>;
    return { id: String(r.id), novelId: String(r.novel_id), userId: String(r.user_id), title: String(r.title), content: String(r.content || ''), order: Number(r.order_index || 0), wordCount: Number(r.word_count || 0), published: Boolean(r.published), fbPostUrl: (r.fb_post_url as string) || null, createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
  }
  async deleteChapter(id: string): Promise<void> { const { error } = await this.sb().from('chapters').delete().eq('id', id); if (error) throw new Error(error.message); }
  async publishChapter(chapterId: string, fbPostUrl?: string): Promise<Chapter> {
    const sb = this.sb();
    const { data: cur } = await sb.from('chapters').select('*').eq('id', chapterId).single();
    const wasPublished = Boolean((cur as Record<string, unknown> | null)?.published);
    const { data, error } = await sb.from('chapters').update({ published: true, fb_post_url: fbPostUrl || null }).eq('id', chapterId).select().single();
    if (error) throw new Error(error.message);
    const r = data as Record<string, unknown>;
    if (!wasPublished) await this.addPoints(String(r.user_id), POINTS.PUBLISH, 'published', `نشر فصل: ${String(r.title)}`, chapterId, String(r.novel_id));
    return { id: String(r.id), novelId: String(r.novel_id), userId: String(r.user_id), title: String(r.title), content: String(r.content || ''), order: Number(r.order_index || 0), wordCount: Number(r.word_count || 0), published: true, fbPostUrl: (r.fb_post_url as string) || null, createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
  }
  async syncEngagement(chapterId: string, reactions: number, comments: number): Promise<{ gained: number }> {
    const sb = this.sb();
    const { data: cur } = await sb.from('chapters').select('*').eq('id', chapterId).single();
    const ch = cur as Record<string, unknown> | null; if (!ch) throw new Error('الفصل غير موجود');
    const newR = Math.max(0, reactions - Number(ch.last_synced_reactions || 0));
    const newC = Math.max(0, comments - Number(ch.last_synced_comments || 0));
    const gained = newR * POINTS.REACTION + newC * POINTS.COMMENT;
    await sb.from('chapters').update({ last_synced_reactions: reactions, last_synced_comments: comments }).eq('id', chapterId);
    if (newR > 0) await this.addPoints(String(ch.user_id), newR * POINTS.REACTION, 'reaction', `+${newR} تفاعل جديد`, chapterId, String(ch.novel_id));
    if (newC > 0) await this.addPoints(String(ch.user_id), newC * POINTS.COMMENT, 'comment', `+${newC} تعليق جديد`, chapterId, String(ch.novel_id));
    return { gained };
  }
  async addPoints(userId: string, amount: number, reason: PointsReason, label: string, chapterId?: string | null, novelId?: string | null): Promise<void> {
    if (amount <= 0) return;
    const sb = this.sb();
    await sb.from('points_events').insert({ user_id: userId, amount, reason, label, chapter_id: chapterId || null, novel_id: novelId || null });
    const { data: prof } = await sb.from('profiles').select('points').eq('id', userId).single();
    if (prof) await sb.from('profiles').update({ points: Number((prof as Record<string, unknown>).points || 0) + amount }).eq('id', userId);
  }
  async listPointsEvents(userId: string): Promise<PointsEvent[]> {
    const { data, error } = await this.sb().from('points_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => ({ id: String(r.id), userId: String(r.user_id), amount: Number(r.amount), reason: r.reason as PointsReason, label: String(r.label), chapterId: (r.chapter_id as string) || null, novelId: (r.novel_id as string) || null, createdAt: String(r.created_at) }));
  }
  async leaderboard(): Promise<{ name: string; points: number; novels: number; chapters: number }[]> {
    const { data, error } = await this.sb().from('profiles').select('id,name,points').order('points', { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    const rows: { name: string; points: number; novels: number; chapters: number }[] = [];
    for (const p of (data || []) as Record<string, unknown>[]) {
      const { count: nc } = await this.sb().from('novels').select('*', { count: 'exact', head: true }).eq('user_id', String(p.id));
      const { count: cc } = await this.sb().from('chapters').select('*', { count: 'exact', head: true }).eq('user_id', String(p.id));
      rows.push({ name: String(p.name), points: Number(p.points || 0), novels: nc || 0, chapters: cc || 0 });
    }
    return rows;
  }
  async requestMembership(profile: Profile, facebookUrl: string, note?: string): Promise<MembershipRequest> {
    const { data, error } = await this.sb().from('membership_requests').insert({ user_id: profile.id, user_name: profile.name, user_email: profile.email, facebook_url: facebookUrl, note: note || null, status: 'pending' }).select().single();
    if (error) throw new Error(error.message);
    await this.updateProfile(profile.id, { facebookUrl, membershipStatus: 'pending' });
    const r = data as Record<string, unknown>;
    return { id: String(r.id), userId: profile.id, userName: profile.name, userEmail: profile.email, facebookUrl, note: note || null, status: 'pending', createdAt: String(r.created_at) };
  }
  async listMembershipRequests(): Promise<MembershipRequest[]> {
    const { data, error } = await this.sb().from('membership_requests').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: Record<string, unknown>) => ({ id: String(r.id), userId: String(r.user_id), userName: String(r.user_name), userEmail: String(r.user_email), facebookUrl: String(r.facebook_url), note: (r.note as string) || null, status: (r.status as MembershipStatus) || 'pending', reviewedBy: (r.reviewed_by as string) || null, createdAt: String(r.created_at), reviewedAt: (r.reviewed_at as string) || null }));
  }
  async reviewMembership(id: string, approved: boolean, reviewer: string): Promise<void> {
    const sb = this.sb();
    const { data } = await sb.from('membership_requests').update({ status: approved ? 'approved' : 'rejected', reviewed_by: reviewer, reviewed_at: new Date().toISOString() }).eq('id', id).select().single();
    if (data) await sb.from('profiles').update({ membership_status: approved ? 'approved' : 'rejected' }).eq('id', String((data as Record<string, unknown>).user_id));
  }
  // ── طلبات العضوية للأدمن (عبر routes الخادم — تتجاوز RLS بأمان) ──
  /** كل الطلبات للأدمن عبر GET /api/admin/requests (service role). */
  async listMembershipRequestsAdmin(): Promise<MembershipRequest[]> {
    const res = await fetch('/api/admin/requests', { headers: { Authorization: `Bearer ${await this.authToken()}` } });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'تعذّر جلب طلبات العضوية');
    return (j.requests || []) as MembershipRequest[];
  }
  /** مراجعة طلب للأدمن عبر POST /api/admin/review (service role). */
  async reviewMembershipAdmin(id: string, approved: boolean, reviewer: string): Promise<void> {
    const res = await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.authToken()}` },
      body: JSON.stringify({ id, approved, reviewer }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'تعذّرت مراجعة الطلب');
  }
  async uploadCover(file: File): Promise<string> {
    const sb = this.sb();
    const path = `${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await sb.storage.from('covers').upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(`رفع الغلاف فشل: ${error.message} — تأكد من إنشاء Bucket باسم covers في Supabase Storage وجعله Public للقراءة.`);
    const { data } = sb.storage.from('covers').getPublicUrl(path);
    return data.publicUrl;
  }
  // ── إدارة الأدمن (عبر routes الخادم — تتجاوز RLS بأمان) ──
  private async authToken(): Promise<string> {
    const { data } = await this.sb().auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error('سجّل دخول أولًا');
    return t;
  }
  async listAdminUsers(): Promise<Profile[]> {
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${await this.authToken()}` } });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'تعذّر جلب المستخدمين');
    return (j.users || []).map((u: Record<string, unknown>) => ({
      id: String(u.id), email: String(u.email || ''), name: String(u.name || ''),
      membershipStatus: (u.membershipStatus as MembershipStatus) || 'none',
      role: (u.role as 'admin' | 'member') || 'member', points: 0, createdAt: '',
    }));
  }
  async setUserRole(email: string, role: 'admin' | 'member'): Promise<void> {
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.authToken()}` },
      body: JSON.stringify({ email, role }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'تعذّر تغيير الدور');
  }
  /** دعوة أدمن سرية: يرسل الكود من رابط ?invite= إلى الخادم. */
  async claimAdminInvite(code: string): Promise<void> {
    const res = await fetch('/api/admin/claim-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.authToken()}` },
      body: JSON.stringify({ code }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'الرابط غير صحيح');
  }
}

export type DB = LocalDB | SupabaseDB;

let instance: DB | null = null;
export function getDB(): DB {
  if (!instance) instance = getSupabase() ? new SupabaseDB() : new LocalDB();
  return instance;
}
export function isSupabaseMode(): boolean { return getSupabase() !== null; }
export function isAdminEmail(email: string): boolean {
  return !!ADMIN_EMAIL && email.trim().toLowerCase() === ADMIN_EMAIL;
}
