import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Chat, ChatRole } from '../entities/chat-entity';
import { User } from '../entities/user-entity';
import { File } from '../entities/file-entity';
import { Workspace } from '../entities/workspace-entity';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { ChatResponseDto } from './dto/chat-response-dto';
import { validateUserExists } from './chat-validations/chat-validations';
import * as fs from 'fs';
import * as path from 'path';

interface ActionDirective {
  type:
    | 'search_files'
    | 'next_result'
    | 'refine_results'
    | 'create_workspace'
    | 'move_all_files'
    | 'move_files_by_tags'
    | 'get_stats'
    | 'generate_link'
    | 'delete_files'
    | 'delete_workspace'
    | 'rename_file';
  query?: string;
  name?: string;
  target_workspace?: string;
  singular?: boolean;
  expires_minutes?: number;
  new_name?: string;
  min_size_mb?: number;
  max_size_mb?: number;
  file_type?: string;
  workspace_name?: string;
  days_ago?: number;
}

interface UserSession {
  lastResults: File[];
  lastQuery: string;
  shownIds: Set<number>;
}

const ACTION_INSTRUCTIONS = `
=== ACTION SYSTEM ===
When the user asks you to perform an operation, append ONE action directive as the very last line of your response.
Format: [ACTION:{"type":"...","key":"value"}]

Available actions:

1. Show / search / filter files:
[ACTION:{"type":"search_files","query":"<what to find>"}]
Optional filters (add any that apply):
  "file_type": "pdf" | "image" | "video" | "audio" | "document" | "spreadsheet" | "presentation" | "text"
  "min_size_mb": <number>
  "max_size_mb": <number>
  "workspace_name": "<workspace name>"
  "singular": true  → ONLY when user wants ONE specific file (see rule below)

━━━ SINGULAR vs PLURAL RULE (CRITICAL) ━━━
Use "singular": true when user refers to ONE file:
  → singular words: "photo", "image", "file", "picture", "video", "the", "that", "my X"
  → examples: "my cat photo", "the gray image", "bring that file", "my CV", "find the report"

Do NOT use "singular" when user wants multiple:
  → plural words: "photos", "images", "files", "pictures", "all", "every", "list"
  → examples: "my cat photos", "all images", "show files", "list my PDFs"

Examples with singular vs plural:
  "bring my gray cat photo"     → [ACTION:{"type":"search_files","query":"gray cat","file_type":"image","singular":true}]
  "show my cat photos"          → [ACTION:{"type":"search_files","query":"cat","file_type":"image"}]
  "find my CV"                  → [ACTION:{"type":"search_files","query":"cv resume","singular":true}]
  "get that sitting cat image"  → [ACTION:{"type":"search_files","query":"sitting cat","file_type":"image","singular":true}]
  "bring me the report"         → [ACTION:{"type":"search_files","query":"report","singular":true}]
  "list all my PDFs"            → [ACTION:{"type":"search_files","query":"pdf","file_type":"pdf"}]
  "show files larger than 20MB" → [ACTION:{"type":"search_files","query":"all","min_size_mb":20}]
  "show files in Work workspace"→ [ACTION:{"type":"search_files","query":"all","workspace_name":"Work"}]
  "list all my files"           → [ACTION:{"type":"search_files","query":"all"}]

2. Delete files (frontend will ask for confirmation):
[ACTION:{"type":"delete_files","query":"<what files to delete>"}]
Optional filters: file_type, min_size_mb, max_size_mb, workspace_name
  "delete my cat photos"                    → [ACTION:{"type":"delete_files","query":"cat photos"}]
  "delete all PDFs"                         → [ACTION:{"type":"delete_files","query":"all","file_type":"pdf"}]
  "delete files larger than 100MB"          → [ACTION:{"type":"delete_files","query":"all","min_size_mb":100}]

3. Delete a workspace (frontend will ask for confirmation):
[ACTION:{"type":"delete_workspace","query":"<workspace name>"}]
  "delete my Work workspace"                → [ACTION:{"type":"delete_workspace","query":"Work"}]

4. Rename a file:
[ACTION:{"type":"rename_file","query":"<current file name or description>","new_name":"<new filename>"}]
  "rename report.pdf to annual-report.pdf"  → [ACTION:{"type":"rename_file","query":"report.pdf","new_name":"annual-report.pdf"}]

5. Create a workspace:
[ACTION:{"type":"create_workspace","name":"<workspace name>"}]
  "create a workspace called Work"          → [ACTION:{"type":"create_workspace","name":"Work"}]

6. Move ALL files to a workspace:
[ACTION:{"type":"move_all_files","target_workspace":"<name>"}]

7. Move specific files to a workspace:
[ACTION:{"type":"move_files_by_tags","query":"<what files>","target_workspace":"<name>"}]

8. Storage statistics:
[ACTION:{"type":"get_stats"}]

9. Generate a shareable link for a file:
[ACTION:{"type":"generate_link","query":"<what file>","expires_minutes":30}]

10. Show NEXT / OTHER result — when user says "other one", "another", "different", "next", "not this one":
[ACTION:{"type":"next_result"}]
  "other one"              → [ACTION:{"type":"next_result"}]
  "show me another"        → [ACTION:{"type":"next_result"}]
  "not this one"           → [ACTION:{"type":"next_result"}]
  "the next one"           → [ACTION:{"type":"next_result"}]
  "a different file"       → [ACTION:{"type":"next_result"}]

11. Refine PREVIOUS results — when user adds criteria to what was already shown:
[ACTION:{"type":"refine_results","query":"<new filter>"}]
Optional: singular, file_type, min_size_mb, max_size_mb, days_ago
  "the gray one from those"    → [ACTION:{"type":"refine_results","query":"gray","singular":true}]
  "only the images"            → [ACTION:{"type":"refine_results","query":"","file_type":"image"}]
  "the smaller one"            → [ACTION:{"type":"refine_results","query":"","max_size_mb":1,"singular":true}]
  "from last week"             → [ACTION:{"type":"refine_results","query":"","days_ago":7}]
  "uploaded yesterday"         → [ACTION:{"type":"refine_results","query":"","days_ago":1}]
  "from this month"            → [ACTION:{"type":"refine_results","query":"","days_ago":30}]

━━━ CONVERSATION FOLLOW-UP RULES ━━━
- "other one" / "another" / "different" / "next" / "not this" → ALWAYS use next_result
- "the X one from those" / "among those" / "from those results" → use refine_results
- "last week" / "yesterday" / "this month" / "recently" → use days_ago in search or refine
- "last week" = days_ago:7, "yesterday" = days_ago:1, "this month" = days_ago:30
- For completely NEW topics → use search_files with fresh query (clears previous context)

━━━ CRITICAL: WHEN TO USE search_files (FRESH) vs next_result/refine ━━━
ALWAYS use search_files (fresh) when the user asks for a DIFFERENT specific file:
  → different color: "gray cat" after "orange cat" → NEW search_files for "gray cat"
  → different subject: "my dog" after "my cat" → NEW search_files for "dog"
  → different file: "the report" after "the photo" → NEW search_files for "report"
ONLY use next_result when user explicitly says: "other", "another", "next", "different one", "not this"
ONLY use refine_results when user FILTERS the SAME results: "the gray one from those", "only PDFs"

QUERY LANGUAGE: Always write the query field in ENGLISH regardless of user language.
  → User says "gri kedi" → query: "gray cat"
  → User says "turuncu araba" → query: "orange car"
EXCEPTION — custom file names / nicknames: If the user refers to a file by a name they personally gave it (visible in conversation history as a renamed filename), use that EXACT name as-is in the query. Do NOT translate it.
  → User renamed a file to "tatlı" then says "bring tatlı" → query: "tatlı"  (do NOT translate to "sweet" or "cute")
  → User renamed a file to "rapor2024" then says "open rapor2024" → query: "rapor2024"

RULES:
- For delete operations: always warn the user what will be deleted and tell them confirmation is needed. Never delete without showing a confirmation button.
- For rename: do it directly, no confirmation needed.
- For create: do it directly.
- Informational/conversational messages → no action.
- Write your reply first, then action(s) each on their own final line.
- Use conversation history to resolve references ("move them there", "that workspace", etc.).
- Do NOT put actions inside a code block.
- Always respond in English.

━━━ CONVERSATION vs ACTION RULES ━━━
These are CONVERSATIONAL questions — respond with text ONLY, NO action directive:
  "how did you know?", "why that one?", "how does this work?", "what is this?",
  "tell me more", "explain", "what do you think?", "are you sure?", "interesting",
  "thank you", "thanks", "ok", "great", "cool", "wow", "nice", "good job",
  Any question about YOU or HOW YOU WORK → text only, no action.

━━━ RESPONSE LENGTH — CRITICAL ━━━
Keep ALL replies SHORT. Maximum 1-2 sentences.
- File actions: write NOTHING before the action line. Zero preamble. No "I've got you", no "I'm gathering", no "Sure!", no "Of course!", no filler of any kind. JUST the [ACTION:...] line.
- Conversational answers: 1-2 sentences max. Be direct. No essays, no lists, no lengthy explanations.
- NEVER start a reply with the user's name.
`;

@Injectable()
export class ChatService {
  private aiModel: ChatGoogleGenerativeAI;
  private systemPrompt: string;
  private readonly sessions = new Map<number, UserSession>();

  private getSession(user_id: number): UserSession {
    if (!this.sessions.has(user_id)) {
      this.sessions.set(user_id, {
        lastResults: [],
        lastQuery: '',
        shownIds: new Set(),
      });
    }
    return this.sessions.get(user_id)!;
  }

  private toFileDto(f: File) {
    return {
      file_id: f.file_id,
      filename: f.filename,
      tags: f.tags,
      mime_type: f.mime_type,
      size: Number(f.size),
      uploaded_at: f.uploaded_at,
    };
  }

  constructor(
    @InjectRepository(Chat) private chatRepo: Repository<Chat>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.aiModel = new ChatGoogleGenerativeAI({
      model: 'gemini-3-flash-preview',
      apiKey: process.env.GEMINI_API_KEY!,
      temperature: 0.4,
    });

    try {
      const siteInfoDir = path.join(__dirname, 'site-info');
      const files = fs
        .readdirSync(siteInfoDir)
        .filter((f) => f.endsWith('.txt'))
        .sort();
      this.systemPrompt = files
        .map((f) => fs.readFileSync(path.join(siteInfoDir, f), 'utf-8').trim())
        .join('\n\n---\n\n');
    } catch {
      this.systemPrompt =
        'You are Syn, a helpful AI assistant for SynapseCloud, an AI-powered cloud storage system.';
    }
  }

  private async classifyIntent(message: string): Promise<'file' | 'chat'> {
    try {
      const res = await this.aiModel.invoke([
        new HumanMessage(
          `Classify this user message. Reply ONLY with the word "file" or "chat".

"file" = user wants to do something with their files or storage:
  - search, find, show, bring, get, fetch, list files/photos/videos/documents
  - delete, remove, rename, move, share files
  - create workspace, get storage stats, generate a link
  - asking about specific content they have stored ("my cat photo", "the report")

"chat" = user wants to have a conversation (no file operation intended):
  - greetings, farewells, thanks, acknowledgements (hi, hello, thanks, ok, great, cool)
  - asking questions about the AI or how things work
  - follow-up questions about a previous response ("how did you know?", "why that one?", "are you sure?")
  - opinions, explanations, general knowledge questions
  - short reactions (yes, no, wow, nice, interesting)
  - any message that does NOT require accessing or modifying files

Message: "${message.replace(/"/g, "'")}"

Reply with exactly one word — "file" or "chat":`,
        ),
      ]);
      const answer = res.content.toString().toLowerCase().trim();
      return answer.startsWith('file') ? 'file' : 'chat';
    } catch {
      return 'file';
    }
  }

  async handleMessage(
    userMessage: string,
    user_id: number,
  ): Promise<ChatResponseDto> {
    const user = await this.getUserInfo(user_id);
    validateUserExists(user);

    const history = await this.getConversationHistory(user_id, 20);
    await this.saveMessage(user_id, ChatRole.USER, userMessage);

    const intent = await this.classifyIntent(userMessage);
    if (intent === 'chat') {
      const reply = await this.getConversationalResponse(userMessage, user!.name);
      await this.saveMessage(user_id, ChatRole.ASSISTANT, reply);
      return { reply, action: 'general' };
    }

    const response = await this.getAIResponse(
      userMessage,
      user!.name,
      user_id,
      history,
    );

    if (!response.reply && response.action !== 'search_files' && response.toast) {
      response.reply = response.toast;
    }

    const historyText =
      response.reply ||
      (response.files?.length ? `Found ${response.files.length} file(s).` : 'Done.');
    await this.saveMessage(user_id, ChatRole.ASSISTANT, historyText);

    return response;
  }

  private async getAIResponse(
    userMessage: string,
    userName: string,
    user_id: number,
    history: Chat[],
  ): Promise<ChatResponseDto> {
    const messages = [
      new SystemMessage(
        `${this.systemPrompt}\n\n${ACTION_INSTRUCTIONS}\n\nUser's name: ${userName}`,
      ),
      ...history.map((h) =>
        h.role === ChatRole.USER
          ? new HumanMessage(h.message)
          : new AIMessage(h.message),
      ),
      new HumanMessage(userMessage),
    ];

    const raw = (await this.aiModel.invoke(messages)).content.toString();
    const { cleanReply, actions } = this.parseActionDirectives(raw);

    if (actions.length === 0) return { reply: cleanReply, action: 'general' };

    const merged: ChatResponseDto = { reply: cleanReply, action: 'general' };
    for (const act of actions) {
      const result = await this.executeAction(act, cleanReply, user_id);
      if (result.files !== undefined) merged.files = result.files;
      if (result.stats !== undefined) merged.stats = result.stats;
      if (result.action !== 'general') merged.action = result.action;
      if (result.toast)
        merged.toast = merged.toast
          ? `${merged.toast} • ${result.toast}`
          : result.toast;
      if (result.workspace_id) merged.workspace_id = result.workspace_id;
      if (result.workspace_name) merged.workspace_name = result.workspace_name;
    }

    if (merged.action === 'search_files') {
      if (!merged.files || merged.files.length === 0) {
        merged.reply = "I couldn't find any files matching your request.";
        merged.files = [];
      } else {
        const fillerPattern = /^(here|i found|found it|i('ve| have) got|i('ll| will)|let me|looking|searching|bringing|fetching|sure|okay|of course|i can see|i located|i'm gathering|gathering|absolutely|great|perfect|right away|on it|got it|certainly|no problem)/i;
        if (fillerPattern.test(merged.reply.trim()) || merged.reply.trim().length < 5) {
          merged.reply = '';
        }
      }
    }

    return merged;
  }

  private parseActionDirectives(raw: string): {
    cleanReply: string;
    actions: ActionDirective[];
  } {
    const actions: ActionDirective[] = [];
    const replyParts: string[] = [];
    let i = 0;

    while (i < raw.length) {
      const idx = raw.indexOf('[ACTION:{', i);
      if (idx === -1) {
        replyParts.push(raw.slice(i));
        break;
      }

      replyParts.push(raw.slice(i, idx));

      let depth = 0,
        jsonEnd = -1;
      for (let j = idx + 8; j < raw.length; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') {
          depth--;
          if (depth === 0) {
            jsonEnd = j;
            break;
          }
        }
      }

      if (jsonEnd === -1) {
        replyParts.push(raw.slice(idx));
        break;
      }

      try {
        actions.push(
          JSON.parse(raw.slice(idx + 8, jsonEnd + 1)) as ActionDirective,
        );
      } catch {}

      i = jsonEnd + 2;
    }

    return { cleanReply: replyParts.join('').trim(), actions };
  }

  private async executeAction(
    action: ActionDirective,
    reply: string,
    user_id: number,
  ): Promise<ChatResponseDto> {
    switch (action.type) {
      case 'search_files': {
        const query = (action.query || '').trim();
        const isAll = !query || /^all$/i.test(query);
        let matches = isAll
          ? await this.getAllUserFiles(user_id)
          : await this.searchFiles(query, user_id, {
              daysAgo: action.days_ago,
            });

        matches = this.applyFilters(matches, action);

        const session = this.getSession(user_id);
        session.lastResults = matches;
        session.lastQuery = query;
        session.shownIds = new Set();

        const toShow = action.singular ? matches.slice(0, 1) : matches;
        toShow.forEach((f) => session.shownIds.add(f.file_id));

        return {
          reply,
          files: toShow.map((f) => this.toFileDto(f)),
          action: 'search_files',
        };
      }

      case 'next_result': {
        const session = this.getSession(user_id);
        let unseen = session.lastResults.filter(
          (f) => !session.shownIds.has(f.file_id),
        );

        if (unseen.length === 0 && session.lastQuery) {
          const fresh = await this.searchFiles(session.lastQuery, user_id);
          unseen = fresh.filter((f) => !session.shownIds.has(f.file_id));
          if (unseen.length > 0)
            session.lastResults = [...session.lastResults, ...unseen];
        }

        if (unseen.length === 0) {
          return {
            reply: 'No more matching files — all results have been shown.',
            action: 'general',
          };
        }

        const next = unseen[0];
        session.shownIds.add(next.file_id);
        return { reply, files: [this.toFileDto(next)], action: 'search_files' };
      }

      case 'refine_results': {
        const session = this.getSession(user_id);
        let pool =
          session.lastResults.length > 0
            ? [...session.lastResults]
            : await this.getAllUserFiles(user_id);

        const query = (action.query || '').trim();
        if (query) {
          const tags = this.extractQueryTags(query);
          if (tags.length > 0) {
            const scored = pool
              .map((f) => {
                const fileTags = f.tags ?? [];
                const total = fileTags.length || 1;
                let score = 0;
                tags.forEach((q) => {
                  fileTags.forEach((t, idx) => {
                    const posBonus = 1 - idx / total;
                    if (t === q) score += 3 + posBonus;
                    else if (t.includes(q) && q.length > 2) score += 1.5 + posBonus * 0.5;
                    else if (q.includes(t) && t.length > 2) score += 1 + posBonus * 0.3;
                  });
                });
                return { f, score };
              })
              .filter((x) => x.score > 0)
              .sort((a, b) => b.score - a.score);
            if (scored.length > 0) pool = scored.map((x) => x.f);
          }
        }

        pool = this.applyFilters(pool, action);

        if (pool.length === 0 && query) {
          const freshResults = await this.searchFiles(query, user_id);
          if (freshResults.length > 0) pool = freshResults;
        }

        session.lastResults = pool;
        session.shownIds = new Set();
        const toShow = action.singular ? pool.slice(0, 1) : pool;
        toShow.forEach((f) => session.shownIds.add(f.file_id));

        return {
          reply,
          files: toShow.map((f) => this.toFileDto(f)),
          action: 'search_files',
        };
      }

      case 'delete_files': {
        const query = (action.query || '').trim();
        const isAll = !query || /^all$/i.test(query);
        let matches = isAll
          ? await this.getAllUserFiles(user_id)
          : await this.searchFiles(query, user_id);

        matches = this.applyFilters(matches, action);

        return {
          reply,
          files: matches.map((f) => ({
            file_id: f.file_id,
            filename: f.filename,
            tags: f.tags,
            mime_type: f.mime_type,
            size: Number(f.size),
            uploaded_at: f.uploaded_at,
          })),
          action: 'delete_files',
        };
      }

      case 'delete_workspace': {
        const wsName = (action.query || '').trim();
        const workspace = await this.workspaceRepo.findOne({
          where: { name: wsName, user: { user_id } },
        });
        if (!workspace)
          return {
            reply: `Workspace "${wsName}" not found.`,
            action: 'general',
          };

        const files = await this.fileRepo.find({
          where: { workspace: { workspace_id: workspace.workspace_id } },
        });

        return {
          reply,
          files: files.map((f) => ({
            file_id: f.file_id,
            filename: f.filename,
            mime_type: f.mime_type,
            size: Number(f.size),
          })),
          action: 'delete_workspace',
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.name,
        };
      }

      case 'rename_file': {
        const query = (action.query || '').trim();
        const newName = (action.new_name || '').trim();
        if (!newName) return { reply, action: 'general' };

        const matches = await this.searchFiles(query, user_id);
        const file = matches[0];
        if (!file)
          return { reply: `File "${query}" not found.`, action: 'general' };

        await this.fileRepo.update(file.file_id, { filename: newName });
        return {
          reply,
          action: 'rename_file',
          toast: `Renamed "${file.filename}" → "${newName}".`,
        };
      }

      case 'generate_link': {
        const query = (action.query || '').trim();
        const files = query ? await this.searchFiles(query, user_id) : [];
        const file = files[0] ?? null;
        return {
          reply,
          files: file
            ? [
                {
                  file_id: file.file_id,
                  filename: file.filename,
                  mime_type: file.mime_type,
                },
              ]
            : [],
          action: 'generate_link',
        };
      }

      case 'create_workspace': {
        const wsName = (action.name || 'New Workspace').trim();
        await this.createWorkspace(wsName, user_id);
        return {
          reply,
          action: 'general',
          toast: `Workspace "${wsName}" created.`,
        };
      }

      case 'move_all_files': {
        const target = (action.target_workspace || '').trim();
        if (target) {
          const files = await this.getAllUserFiles(user_id);
          if (files.length > 0)
            await this.batchMove(
              target,
              files.map((f) => f.file_id),
              user_id,
            );
          return {
            reply,
            action: 'general',
            toast: `Moved ${files.length} file${files.length !== 1 ? 's' : ''} to "${target}".`,
          };
        }
        return { reply, action: 'general' };
      }

      case 'move_files_by_tags': {
        const target = (action.target_workspace || '').trim();
        const query = (action.query || '').trim();
        if (target && query) {
          const files = await this.searchFiles(query, user_id);
          if (files.length > 0)
            await this.batchMove(
              target,
              files.map((f) => f.file_id),
              user_id,
            );
          return {
            reply,
            action: 'general',
            toast: `Moved ${files.length} file${files.length !== 1 ? 's' : ''} to "${target}".`,
          };
        }
        return { reply, action: 'general' };
      }

      case 'get_stats':
        return {
          reply,
          stats: await this.getFileStats(user_id),
          action: 'stats',
        };

      default:
        return { reply, action: 'general' };
    }
  }

  private applyFilters(files: File[], action: ActionDirective): File[] {
    let result = files;

    if (action.workspace_name) {
      const wn = action.workspace_name.toLowerCase();
      result = result.filter((f) => f.workspace?.name?.toLowerCase() === wn);
    }

    if (action.file_type) {
      result = result.filter((f) =>
        this.matchesFileType(f.mime_type, action.file_type!),
      );
    }

    if (action.min_size_mb !== undefined) {
      const minBytes = action.min_size_mb * 1_048_576;
      result = result.filter((f) => Number(f.size) >= minBytes);
    }

    if (action.max_size_mb !== undefined) {
      const maxBytes = action.max_size_mb * 1_048_576;
      result = result.filter((f) => Number(f.size) <= maxBytes);
    }

    if (action.days_ago !== undefined) {
      const since = new Date(Date.now() - action.days_ago * 86_400_000);
      result = result.filter((f) => new Date(f.uploaded_at) >= since);
    }

    return result;
  }

  private matchesFileType(mime: string, type: string): boolean {
    const m = (mime || '').toLowerCase();
    switch (type.toLowerCase()) {
      case 'pdf':
        return m === 'application/pdf';
      case 'image':
        return m.startsWith('image/');
      case 'video':
        return m.startsWith('video/');
      case 'audio':
        return m.startsWith('audio/');
      case 'document':
        return (
          m.includes('word') ||
          m.includes('document') ||
          m === 'application/msword'
        );
      case 'spreadsheet':
        return m.includes('sheet') || m.includes('excel');
      case 'presentation':
        return m.includes('presentation') || m.includes('powerpoint');
      case 'text':
        return m.startsWith('text/');
      default:
        return true;
    }
  }

  private async searchFiles(
    query: string,
    user_id: number,
    options?: { daysAgo?: number },
  ): Promise<File[]> {
    let allFiles = await this.getAllUserFiles(user_id);
    if (!allFiles.length) return [];

    if (options?.daysAgo !== undefined) {
      const since = new Date(Date.now() - options.daysAgo * 86_400_000);
      allFiles = allFiles.filter((f) => new Date(f.uploaded_at) >= since);
    }

    const exactMatch = allFiles.filter(
      (f) => f.filename.toLowerCase().replace(/\.[^.]+$/, '') === query.toLowerCase().trim(),
    );
    if (exactMatch.length > 0) return exactMatch;

    const searchTags = this.extractQueryTags(query);

    if (searchTags.length > 0) {
      const scored = allFiles
        .map((f) => {
          const fileTags = f.tags ?? [];
          const total = fileTags.length || 1;
          let score = 0;
          searchTags.forEach((q) => {
            fileTags.forEach((t, idx) => {
              const posBonus = 1 - idx / total;
              if (t === q) {
                score += 3 + posBonus;
              } else if (t.includes(q) && q.length > 2) {
                score += 1.5 + posBonus * 0.5;
              } else if (q.includes(t) && t.length > 2) {
                score += 1 + posBonus * 0.3;
              }
            });
          });
          return { f, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) return scored.map((x) => x.f).slice(0, 20);
    }

    const nameFallback = allFiles
      .filter((f) => {
        const name = f.filename.toLowerCase().replace(/\.[^.]+$/, '');
        return searchTags.some((w) => name.includes(w));
      })
      .slice(0, 20);

    if (nameFallback.length > 0) return nameFallback;

    const rawQ = query.toLowerCase().trim();
    const rawWords = rawQ.split(/\s+/).filter((w) => w.length > 1);
    const rawFallback = allFiles
      .filter((f) => {
        const name = f.filename.toLowerCase().replace(/\.[^.]+$/, '');
        return name.includes(rawQ) || rawWords.some((w) => name.includes(w));
      })
      .slice(0, 20);

    if (rawFallback.length > 0) return rawFallback;

    return this.aiFileSelector(query, allFiles);
  }

  private async aiFileSelector(query: string, files: File[]): Promise<File[]> {
    if (!files.length) return [];

    const list = files
      .filter((f) => (f.tags || []).length > 0)
      .slice(0, 50)
      .map(
        (f) =>
          `${f.file_id}: "${f.filename}" | ${(f.tags || []).slice(0, 10).join(', ')} | ${new Date(f.uploaded_at).toLocaleDateString()}`,
      )
      .join('\n');

    if (!list) return [];

    const prompt = `User is searching for: "${query}"

Files:
${list}

Return ONLY the matching file IDs as comma-separated numbers. If none match, return: none`;

    try {
      const res = await this.aiModel.invoke([new HumanMessage(prompt)]);
      const raw = res.content.toString().trim().toLowerCase();
      if (!raw || raw === 'none') return [];
      const ids = raw
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));
      return files.filter((f) => ids.includes(f.file_id)).slice(0, 20);
    } catch {
      return [];
    }
  }

  private extractQueryTags(query: string): string[] {
    const stopwords = new Set([
      'the',
      'and',
      'or',
      'of',
      'in',
      'on',
      'at',
      'to',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'my',
      'your',
      'our',
      'their',
      'its',
      'his',
      'her',
      'can',
      'you',
      'bring',
      'show',
      'find',
      'get',
      'please',
      'me',
      'i',
      'we',
      'it',
      'that',
      'this',
      'with',
      'for',
      'from',
      'by',
      'about',
      'all',
      'any',
      'have',
      'has',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'want',
      'need',
      'give',
      'take',
      'see',
      'look',
      'let',
      'those',
      'these',
      'file',
      'files',
      'photo',
      'photos',
      'image',
      'images',
      'picture',
      'pictures',
      'document',
      'documents',
      'video',
      'videos',
      'audio',
    ]);

    const trToEn: Record<string, string> = {
      gri: 'gray', turuncu: 'orange', kirmizi: 'red', mavi: 'blue',
      yesil: 'green', sari: 'yellow', beyaz: 'white', siyah: 'black',
      kahverengi: 'brown', mor: 'purple', pembe: 'pink', lacivert: 'navy',
      kedi: 'cat', kopek: 'dog', kus: 'bird', balik: 'fish',
      araba: 'car', ev: 'house', agac: 'tree', cicek: 'flower',
      insan: 'person', cocuk: 'child', kadinlar: 'women', erkek: 'man',
      resim: 'image', fotograf: 'photo', belge: 'document', video: 'video',
      getir: '', goster: '', bul: '', ver: '', istiyorum: '', lutfen: '',
    };

    const synonyms: Record<string, string[]> = {
      grey: ['gray', 'gray fur', 'grey fur'],
      gray: ['grey', 'gray fur', 'grey fur'],
      orange: ['orange fur', 'orange coat'],
      black: ['black fur', 'black coat'],
      white: ['white fur', 'white coat'],
      brown: ['brown fur', 'brown coat'],
      cream: ['cream fur', 'cream coat'],
      tabby: ['tabby', 'striped fur'],
      cat: ['kitten', 'kitty', 'feline'],
      dog: ['puppy', 'canine'],
      cv: ['resume'],
      resume: ['cv'],
      pic: ['photo'],
      photo: ['pic'],
    };

    const rawWords = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const words = rawWords
      .map((w) => (trToEn[w] !== undefined ? trToEn[w] : w))
      .filter((w) => w.length > 1 && !stopwords.has(w));

    const expanded: string[] = [...words];
    for (const w of words) {
      const syns = synonyms[w];
      if (syns) expanded.push(...syns);
    }

    return [...new Set(expanded)];
  }

  private getAllUserFiles(user_id: number): Promise<File[]> {
    return this.fileRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.workspace', 'workspace')
      .innerJoin('workspace.user', 'user')
      .where('user.user_id = :user_id', { user_id })
      .orderBy('file.uploaded_at', 'DESC')
      .getMany();
  }

  private async getFileStats(user_id: number) {
    const files = await this.getAllUserFiles(user_id);
    const totalSize = files.reduce((s, f) => s + Number(f.size), 0);
    const largest = files.length
      ? files.reduce(
          (m, f) => (Number(f.size) > Number(m.size) ? f : m),
          files[0],
        )
      : null;

    const tagCounts: Record<string, number> = {};
    files.forEach((f) =>
      (f.tags ?? []).forEach((t) => {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }),
    );

    return {
      total_files: files.length,
      total_size_mb: (totalSize / 1_048_576).toFixed(2),
      largest_file: largest?.filename ?? null,
      most_used_tags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map((e) => e[0]),
    };
  }

  private createWorkspace(name: string, user_id: number) {
    return this.workspaceRepo.save(
      this.workspaceRepo.create({ name, description: '', user: { user_id } }),
    );
  }

  private async batchMove(
    workspaceName: string,
    fileIds: number[],
    user_id: number,
  ) {
    const filesToMove = await this.fileRepo.find({
      where: { file_id: In(fileIds) },
      relations: ['workspace'],
    });
    const sourceIds = [
      ...new Set(
        filesToMove
          .map((f) => f.workspace?.workspace_id)
          .filter((id): id is number => !!id),
      ),
    ];

    let workspace = await this.workspaceRepo.findOne({
      where: { name: workspaceName, user: { user_id } },
    });
    if (!workspace) {
      workspace = await this.workspaceRepo.save(
        this.workspaceRepo.create({ name: workspaceName, user: { user_id } }),
      );
    }

    await this.fileRepo
      .createQueryBuilder()
      .update(File)
      .set({ workspace: { workspace_id: workspace.workspace_id } } as any)
      .where('file_id IN (:...ids)', { ids: fileIds })
      .execute();

    const allIds = [...new Set([...sourceIds, workspace.workspace_id])];
    await Promise.all(
      allIds.map((wsId) =>
        this.cacheManager.del(
          `cache_user_${user_id}_url_/v1/files/workspaces/${wsId}/files`,
        ),
      ),
    );
  }

  private async getConversationHistory(
    user_id: number,
    limit = 20,
  ): Promise<Chat[]> {
    const msgs = await this.chatRepo.find({
      where: { user: { user_id } },
      order: { created_at: 'DESC' },
      take: limit,
    });
    return msgs.reverse();
  }

  private getUserInfo(user_id: number) {
    return this.userRepo.findOne({ where: { user_id } });
  }

  private async getConversationalResponse(
    userMessage: string,
    userName: string,
  ): Promise<string> {
    const messages = [
      new SystemMessage(
        `${this.systemPrompt}\n\nYou are Syn, a friendly AI assistant for SynapseCloud. Have a natural conversation with the user. Keep every reply to 1-2 sentences maximum — be direct and concise. Never write long explanations or lists. IMPORTANT: Do NOT mention, reference, or invent any file operations (renames, searches, deletions, uploads). Just respond to the user's current message. User's name: ${userName}`,
      ),
      new HumanMessage(userMessage),
    ];

    const raw = (await this.aiModel.invoke(messages)).content.toString();
    return raw.trim();
  }

  private async saveMessage(user_id: number, role: ChatRole, message: string) {
    await this.chatRepo.save(
      this.chatRepo.create({ user: { user_id }, role, message }),
    );
  }
}
