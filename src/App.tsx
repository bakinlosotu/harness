import React, { useState, useEffect, useRef } from 'react';
import {
  Conversation,
  ConversationMeta,
  Doc,
  Keys,
  Message,
  MessageImage,
  ModelRef,
  Theme,
  deleteConversation,
  deleteDoc,
  getConversation,
  getConversationIndex,
  getDocIndex,
  getLastModel,
  getStoredTheme,
  loadKeys,
  saveConversation,
  saveDocWithChunks,
  setLastModel,
  setQuotaExceededHandler,
  setStoredTheme,
  getAutoJudge,
  setAutoJudge,
} from './lib/storage';
import { generateId } from './lib/ids';
import { DEFAULT_SYSTEM_PROMPT, generateAutoTitle, retrieveDocumentContext } from './lib/rag';
import { parseDocumentFile, isSupportedDocFile } from './lib/parse';
import { isSupportedImageType, MAX_IMAGES_PER_MESSAGE } from './lib/images';
import { searchTavily, searchWikipedia, buildWebResultsText } from './lib/webSearch';
import { pickJudgeModel, evaluateResponse } from './lib/judge';
import { selectCouncilMembers, runCouncilDeliberation } from './lib/council';
import { getProvider } from './providers';
import { ChatMsg } from './providers/types';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { RightPanel } from './components/RightPanel';
import { KeysModal } from './components/KeysModal';
import { SettingsModal } from './components/SettingsModal';
import { DiagnosticsModal } from './components/Diagnostics';
import { useToast, ToastProvider } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';

function MainApp() {
  const { toast } = useToast();

  // Storage and Keys
  const [keys, setKeys] = useState<Keys>({});
  const [theme, setTheme] = useState<Theme>('system');
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [currentModel, setCurrentModel] = useState<ModelRef | null>(null);
  const [autoJudge, setAutoJudgeState] = useState<boolean>(() => getAutoJudge());

  const handleToggleAutoJudge = () => {
    setAutoJudgeState((prev) => {
      const next = !prev;
      setAutoJudge(next);
      toast(`Auto-Judge ${next ? 'enabled' : 'disabled'}: ${next ? 'every response evaluated' : 'evaluation off'}`, 'info');
      return next;
    });
  };

  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'documents' | 'email'>('documents');
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Modals
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'keys' | 'chat' | 'data'>('keys');
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const streamingConvIdRef = useRef<string | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // Set quota handler
  useEffect(() => {
    setQuotaExceededHandler(() => {
      toast('Browser storage is full. Delete old chats or documents.', 'error');
    });
  }, [toast]);

  // Apply Theme
  useEffect(() => {
    const storedTheme = getStoredTheme();
    setTheme(storedTheme);
    applyThemeToDoc(storedTheme);
  }, []);

  const applyThemeToDoc = (t: Theme) => {
    const root = document.documentElement;
    if (t === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', t);
    }
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setStoredTheme(newTheme);
    applyThemeToDoc(newTheme);
  };

  const handleThemeToggle = () => {
    // If currently dark (or system resolved to dark), switch to light, else dark
    const isCurrentlyDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    handleThemeChange(isCurrentlyDark ? 'light' : 'dark');
  };

  // Initial Data Load
  useEffect(() => {
    const loadedKeys = loadKeys();
    setKeys(loadedKeys);

    // Load last model
    const lastM = getLastModel();
    if (lastM && loadedKeys[lastM.provider]) {
      setCurrentModel(lastM);
    }

    // Load Documents index
    getDocIndex().then((docs) => setDocuments(docs));

    // Load Conversations index
    getConversationIndex().then((convList) => {
      setConversations(convList);
      if (convList.length > 0) {
        loadConversation(convList[0].id);
      } else {
        createNewChat();
      }
    });

    // If Tavily key is present, ensure default web search is enabled
    if (loadedKeys.tavily) {
      toast('Tavily web search is ready', 'info');
    }

    // Handle responsive side panels on desktop
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(false); // Clean initial view like screenshot
      setIsRightPanelOpen(false);
    }
  }, []);

  // Sync active model with keys
  useEffect(() => {
    if (currentModel && !keys[currentModel.provider]) {
      setCurrentModel(null);
      setLastModel(null);
    }
  }, [keys, currentModel]);

  const loadConversation = async (id: string) => {
    const conv = await getConversation(id);
    if (conv) {
      setCurrentConvId(conv.id);
      setCurrentConversation(conv);
      if (conv.model && keys[conv.model.provider]) {
        setCurrentModel(conv.model);
        setLastModel(conv.model);
      }
    }
  };

  const createNewChat = () => {
    const id = generateId('conv');
    const newConv: Conversation = {
      id,
      title: 'New chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      docIds: [],
      webSearch: !!keys.tavily, // Enabled by default if Tavily key is set
      settings: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        temperature: null,
      },
      model: currentModel,
    };

    saveConversation(newConv).then(() => {
      getConversationIndex().then((list) => setConversations(list));
      setCurrentConvId(newConv.id);
      setCurrentConversation(newConv);
    });
  };

  const handleSelectModel = (model: ModelRef) => {
    setCurrentModel(model);
    setLastModel(model);
    if (currentConversation) {
      const updated: Conversation = {
        ...currentConversation,
        model,
        updatedAt: Date.now(),
      };
      setCurrentConversation(updated);
      saveConversation(updated);
    }
  };

  const handleToggleWebSearch = () => {
    if (!currentConversation) {
      createNewChat();
      return;
    }
    const nextVal = !currentConversation.webSearch;
    const updated: Conversation = {
      ...currentConversation,
      webSearch: nextVal,
      updatedAt: Date.now(),
    };
    setCurrentConversation(updated);
    saveConversation(updated);
    if (nextVal) {
      toast(keys.tavily ? 'Web search enabled (Tavily)' : 'Web search enabled (Wikipedia)', 'info');
    } else {
      toast('Web search disabled', 'info');
    }
  };

  const handleToggleDoc = (docId: string) => {
    if (!currentConversation) return;
    const exists = currentConversation.docIds.includes(docId);
    const updatedDocIds = exists
      ? currentConversation.docIds.filter((d) => d !== docId)
      : [...currentConversation.docIds, docId];

    const updated: Conversation = {
      ...currentConversation,
      docIds: updatedDocIds,
      updatedAt: Date.now(),
    };
    setCurrentConversation(updated);
    saveConversation(updated);
  };

  const handleUploadFile = async (file: File) => {
    setUploadProgress(`Reading ${file.name}…`);
    try {
      const { doc, chunks } = await parseDocumentFile(file, (msg) => setUploadProgress(msg));

      // Check dedupe hash
      const existing = documents.find((d) => d.hash === doc.hash);
      if (existing) {
        toast('Already added', 'info');
        if (currentConversation && !currentConversation.docIds.includes(existing.id)) {
          handleToggleDoc(existing.id);
        }
        return;
      }

      await saveDocWithChunks(doc, chunks);
      const updatedDocs = await getDocIndex();
      setDocuments(updatedDocs);
      toast(`Added ${doc.name}`, 'success');

      // Automatically check for current conversation
      if (currentConversation && !currentConversation.docIds.includes(doc.id)) {
        handleToggleDoc(doc.id);
      }
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    await deleteDoc(docId);
    const updatedDocs = await getDocIndex();
    setDocuments(updatedDocs);
    if (currentConversation && currentConversation.docIds.includes(docId)) {
      setCurrentConversation({
        ...currentConversation,
        docIds: currentConversation.docIds.filter((d) => d !== docId),
      });
    }
    toast('Document deleted.', 'success');
  };

  const handleRenameConv = async (id: string, newTitle: string) => {
    const conv = await getConversation(id);
    if (conv) {
      conv.title = newTitle;
      conv.updatedAt = Date.now();
      await saveConversation(conv);
      const list = await getConversationIndex();
      setConversations(list);
      if (currentConvId === id) {
        setCurrentConversation(conv);
      }
    }
  };

  const handleDeleteConv = async (id: string) => {
    await deleteConversation(id);
    const list = await getConversationIndex();
    setConversations(list);
    if (currentConvId === id) {
      if (list.length > 0) {
        loadConversation(list[0].id);
      } else {
        createNewChat();
      }
    }
    toast('Chat deleted.', 'success');
  };

  const handleUpdateConversationSettings = (newSettings: {
    systemPrompt: string;
    temperature: number | null;
  }) => {
    if (!currentConversation) return;
    const updated: Conversation = {
      ...currentConversation,
      settings: newSettings,
      updatedAt: Date.now(),
    };
    setCurrentConversation(updated);
    saveConversation(updated);
  };

  // Stop current stream
  const handleStopStream = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setIsStreaming(false);

    // Mark current streaming message as stopped
    const convId = streamingConvIdRef.current;
    if (convId) {
      getConversation(convId).then((c) => {
        if (c) {
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant' && last.status === 'streaming') {
            last.status = 'stopped';
            saveConversation(c);
            if (currentConvId === convId) {
              setCurrentConversation({ ...c });
            }
          }
        }
      });
    }
  };

  // SEND MESSAGE HANDLER
  const handleSendMessage = async (text: string, images: MessageImage[]) => {
    if (isStreaming) return;

    // Ensure conversation exists
    let conv = currentConversation;
    if (!conv) {
      const newId = generateId('conv');
      conv = {
        id: newId,
        title: 'New chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        docIds: [],
        webSearch: false,
        settings: { systemPrompt: DEFAULT_SYSTEM_PROMPT, temperature: null },
        model: currentModel,
      };
      setCurrentConvId(conv.id);
      setCurrentConversation(conv);
    }

    if (!currentModel) {
      toast('Choose a model first.', 'info');
      return;
    }

    const modelKey = keys[currentModel.provider];
    if (!modelKey) {
      toast(`Add a ${currentModel.provider} key in Settings to send messages.`, 'error');
      setSettingsInitialTab('keys');
      setIsSettingsModalOpen(true);
      return;
    }

    // 1. Append user message
    const userMsg: Message = {
      id: generateId('msg'),
      role: 'user',
      text,
      images: images.length > 0 ? images : undefined,
      createdAt: Date.now(),
    };

    const targetConvId = conv.id;
    conv.messages.push(userMsg);
    conv.updatedAt = Date.now();
    await saveConversation(conv);
    setCurrentConversation({ ...conv });

    // 2. Prepare Assistant message
    const assistantMsgId = generateId('msg');
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      model: currentModel,
      citations: [],
      status: 'streaming',
      createdAt: Date.now(),
    };

    conv.messages.push(assistantMsg);
    setCurrentConversation({ ...conv });

    setIsStreaming(true);
    streamingConvIdRef.current = targetConvId;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      // 3. Web Search retrieval if toggled
      let webContextBlock = '';
      const allCitations: any[] = [];

      const shouldSearch = conv.webSearch || !!keys.tavily;

      if (shouldSearch) {
        let searchRes = null;
        if (keys.tavily) {
          toast('Searching the web with Tavily…', 'info');
          searchRes = await searchTavily(keys.tavily, text);
        } else {
          toast('Searching the web with Wikipedia…', 'info');
          searchRes = await searchWikipedia(text);
        }

        if (searchRes && searchRes.sources.length > 0) {
          const built = buildWebResultsText(searchRes.sources, 1);
          webContextBlock = built.text;
          allCitations.push(...built.citations);
          if (searchRes.notice) {
            toast(searchRes.notice, 'success');
          }
        } else if (searchRes?.notice) {
          toast(searchRes.notice, 'info');
        }
      }

      // 4. Documents RAG retrieval if documents selected
      let docContextBlock = '';
      if (conv.docIds.length > 0) {
        const prevUserMsg = conv.messages
          .filter((m) => m.role === 'user')
          .slice(-2, -1)[0]?.text || '';

        const nextCiteNum = allCitations.length + 1;
        const rag = await retrieveDocumentContext(
          conv.docIds,
          text,
          prevUserMsg,
          nextCiteNum
        );

        if (rag.contextBlock) {
          docContextBlock = rag.contextBlock;
          allCitations.push(...rag.citations);
        }
      }

      // 5. Build context budget and messages payload
      // System prompt + retrieved context + messages up to 60k chars
      let extraContext = '';
      if (webContextBlock && docContextBlock) {
        extraContext = `${webContextBlock}\n\n${docContextBlock}\n\nQuestion: `;
      } else if (webContextBlock) {
        extraContext = `${webContextBlock}\n\nQuestion: `;
      } else if (docContextBlock) {
        extraContext = `${docContextBlock}\n\nQuestion: `;
      }

      // Convert messages to ChatMsg, truncate history to fit 60,000 characters
      const systemPrompt = conv.settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
      const historyBudget = 60000 - systemPrompt.length - extraContext.length;

      const rawChatMsgs: ChatMsg[] = [];
      let accumulatedChars = 0;

      // Iterate backwards from the newest user message
      const pastMessages = conv.messages.slice(0, -1); // exclude the pending assistant message
      for (let i = pastMessages.length - 1; i >= 0; i--) {
        const m = pastMessages[i];
        let mText = m.text;
        if (i === pastMessages.length - 1 && extraContext) {
          // Prepend context block to the newest user question
          mText = `${extraContext}${mText}`;
        }

        if (accumulatedChars + mText.length > historyBudget && i < pastMessages.length - 1) {
          // Drop older messages to stay within context budget
          break;
        }

        accumulatedChars += mText.length;
        rawChatMsgs.unshift({
          role: m.role,
          text: mText,
          // Images: include ONLY from newest user message per spec 6.3
          images: i === pastMessages.length - 1 ? m.images : undefined,
        });
      }

      // 6. Invoke provider adapter
      const adapter = getProvider(currentModel.provider);
      let fullAssistantText = '';

      await adapter.chat({
        model: currentModel.id,
        system: systemPrompt,
        messages: rawChatMsgs,
        temperature: conv.settings.temperature,
        key: modelKey,
        signal: controller.signal,
        geminiSearch: false, // Pre-grounded with retrieved sources above
        onText: (delta) => {
          fullAssistantText += delta;

          // Update message in state
          assistantMsg.text = fullAssistantText;
          assistantMsg.citations = allCitations;

          // Throttled save (once per second during streaming)
          const now = Date.now();
          if (now - lastSaveTimeRef.current > 1000) {
            lastSaveTimeRef.current = now;
            getConversation(targetConvId).then((c) => {
              if (c) {
                const targetMsg = c.messages.find((m) => m.id === assistantMsgId);
                if (targetMsg) {
                  targetMsg.text = fullAssistantText;
                  targetMsg.citations = allCitations;
                  saveConversation(c);
                }
              }
            });
          }

          // Trigger React re-render
          setCurrentConversation((prev) => {
            if (!prev || prev.id !== targetConvId) return prev;
            return {
              ...prev,
              messages: [...prev.messages],
            };
          });
        },
        onCitations: (groundingCites) => {
          for (const gc of groundingCites) {
            const nextNum = allCitations.length + 1;
            allCitations.push({
              n: nextNum,
              kind: 'web',
              title: gc.title,
              url: gc.url,
              excerpt: '',
            });
          }
          assistantMsg.citations = allCitations;
        },
        onNotice: (notice) => {
          toast(notice, 'info');
        },
      });

      // Stream successfully completed
      assistantMsg.status = 'done';
      assistantMsg.citations = allCitations;

      // Auto-title on first assistant reply per spec 6.3
      const firstUser = conv.messages.find((m) => m.role === 'user');
      if (firstUser && (conv.title === 'New chat' || !conv.title)) {
        conv.title = generateAutoTitle(firstUser.text);
      }

      conv.updatedAt = Date.now();
      await saveConversation(conv);
      const list = await getConversationIndex();
      setConversations(list);

      setCurrentConversation((prev) => {
        if (!prev || prev.id !== targetConvId) return prev;
        return { ...conv };
      });

      // LLM as a Judge: Auto-evaluate response if enabled
      if (autoJudge) {
        handleJudgeMessage(assistantMsgId);
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        assistantMsg.status = 'stopped';
      } else {
        assistantMsg.status = 'error';
        assistantMsg.error = err?.message || 'Failed to complete reply.';
      }

      conv.updatedAt = Date.now();
      await saveConversation(conv);
      setCurrentConversation((prev) => {
        if (!prev || prev.id !== targetConvId) return prev;
        return { ...conv };
      });
    } finally {
      setIsStreaming(false);
      activeAbortControllerRef.current = null;
      streamingConvIdRef.current = null;
    }
  };

  // Retry last assistant message with same model
  const handleRetry = () => {
    if (!currentConversation || currentConversation.messages.length === 0) return;
    const msgs = [...currentConversation.messages];
    const lastIdx = msgs.length - 1;
    if (msgs[lastIdx].role === 'assistant') {
      msgs.pop(); // Remove assistant answer
    }
    const lastUser = msgs[msgs.length - 1];
    if (lastUser && lastUser.role === 'user') {
      currentConversation.messages = msgs;
      handleSendMessage(lastUser.text, lastUser.images || []);
    }
  };

  // Retry with chosen model
  const handleRetryWith = (chosenModel: ModelRef) => {
    if (!currentConversation || currentConversation.messages.length === 0) return;
    handleSelectModel(chosenModel);
    setTimeout(() => {
      handleRetry();
    }, 50);
  };

  // Edit last user message
  const handleEditUserMessage = (newText: string) => {
    if (!currentConversation || currentConversation.messages.length === 0) return;
    const msgs = [...currentConversation.messages];
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx !== -1) {
      const keepImages = msgs[lastUserIdx].images || [];
      currentConversation.messages = msgs.slice(0, lastUserIdx);
      handleSendMessage(newText, keepImages);
    }
  };

  // Handle dropped files onto chat
  const handleUploadDroppedFiles = async (files: FileList) => {
    const imagesToAttach: File[] = [];
    const docsToUpload: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (isSupportedImageType(f)) {
        imagesToAttach.push(f);
      } else if (isSupportedDocFile(f)) {
        docsToUpload.push(f);
      } else {
        toast(`${f.name} isn't supported.`, 'error');
      }
    }

    for (const d of docsToUpload) {
      await handleUploadFile(d);
    }
  };

  // LLM as a Judge: Evaluate accuracy of an assistant reply
  const handleJudgeMessage = async (messageId: string, customJudgeModel?: ModelRef) => {
    if (!currentConversation) return;
    const conv = { ...currentConversation };
    const targetMsgIdx = conv.messages.findIndex((m) => m.id === messageId);
    if (targetMsgIdx === -1) return;

    const assistantMsg = conv.messages[targetMsgIdx];
    if (assistantMsg.role !== 'assistant' || !assistantMsg.text.trim()) return;

    // Find preceding user query
    let userQuery = '';
    for (let i = targetMsgIdx - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') {
        userQuery = conv.messages[i].text;
        break;
      }
    }
    if (!userQuery) userQuery = 'General query';

    // Pick judge model (prioritizing an independent model from another AI lab)
    const judgeModel = customJudgeModel || pickJudgeModel(assistantMsg.model, keys);
    if (!judgeModel) {
      toast('No suitable judge model found. Add an API key from another AI provider in Settings.', 'error');
      return;
    }

    const judgeKey = keys[judgeModel.provider];
    if (!judgeKey) {
      toast(`Missing API key for judge model ${judgeModel.label}.`, 'error');
      return;
    }

    // Set evaluating state
    assistantMsg.judge = {
      id: generateId('judge'),
      judgeModel,
      evaluatedAt: Date.now(),
      overallScore: 0,
      accuracyScore: 0,
      completenessScore: 0,
      clarityScore: 0,
      hallucinationRisk: 'low',
      verdict: 'Accurate & Reliable',
      summary: '',
      strengths: [],
      weaknesses: [],
      status: 'judging',
    };
    setCurrentConversation({ ...conv });

    try {
      const contextText =
        assistantMsg.citations?.map((c) => `[${c.n}] ${c.title}: ${c.excerpt}`).join('\n') || '';

      const evalResult = await evaluateResponse({
        userQuery,
        assistantResponse: assistantMsg.text,
        retrievedContext: contextText,
        evaluatedModel: assistantMsg.model,
        judgeModel,
        key: judgeKey,
      });

      assistantMsg.judge = evalResult;
      conv.updatedAt = Date.now();
      await saveConversation(conv);
      setCurrentConversation({ ...conv });
      toast(`Judge (${judgeModel.label}): Accuracy graded ${evalResult.overallScore}/100`, 'success');
    } catch (err: any) {
      assistantMsg.judge.status = 'error';
      assistantMsg.judge.error = err?.message || 'Judge evaluation error';
      await saveConversation(conv);
      setCurrentConversation({ ...conv });
    }
  };

  // AI Council: Multi-Model Debate & Consensus
  const handleSendCouncil = async (topic: string, images: MessageImage[] = []) => {
    if (!topic.trim()) return;

    const councilMembers = selectCouncilMembers(keys);
    if (councilMembers.length < 2) {
      toast('AI Council requires at least 2 models. Please add API keys in Settings.', 'error');
      setIsSettingsModalOpen(true);
      return;
    }

    let targetConvId = currentConvId;
    let conv: Conversation;

    if (!targetConvId || !currentConversation) {
      const newId = generateId('conv');
      conv = {
        id: newId,
        title: `Council: ${topic.slice(0, 24)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        docIds: [],
        webSearch: false,
        settings: {
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          temperature: null,
        },
        model: currentModel,
      };
      targetConvId = newId;
      setCurrentConvId(newId);
    } else {
      conv = { ...currentConversation };
    }

    // 1. User message
    const userMsgId = generateId('msg');
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      text: `[🏛️ AI Council Deliberation]\n${topic}`,
      images: images.length > 0 ? images : undefined,
      createdAt: Date.now(),
    };
    conv.messages.push(userMsg);

    // 2. Council Assistant message
    const councilMsgId = generateId('msg');
    const chair = councilMembers[0].model;
    const councilMsg: Message = {
      id: councilMsgId,
      role: 'assistant',
      text: '',
      model: {
        provider: chair.provider,
        id: 'ai-council',
        label: `AI Council (${councilMembers.length} Models)`,
      },
      status: 'streaming',
      createdAt: Date.now(),
      council: {
        id: generateId('council'),
        topic,
        members: councilMembers,
        chairModel: chair,
        currentRound: 1,
        round1: councilMembers.map((m) => ({
          member: m,
          round: 1,
          text: '',
          status: 'streaming',
        })),
        round2: [],
        status: 'convening',
      },
    };
    conv.messages.push(councilMsg);
    setCurrentConversation({ ...conv });

    setIsStreaming(true);
    streamingConvIdRef.current = targetConvId;
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    toast(`Convening AI Council with ${councilMembers.map((m) => m.model.label).join(', ')}…`, 'info');

    try {
      // Gather documents and web context
      let contextBlock = '';
      if (conv.docIds.length > 0) {
        const rag = await retrieveDocumentContext(conv.docIds, topic, '', 1);
        if (rag.contextBlock) contextBlock += rag.contextBlock + '\n\n';
      }
      if (conv.webSearch || !!keys.tavily) {
        const searchRes = keys.tavily
          ? await searchTavily(keys.tavily, topic)
          : await searchWikipedia(topic);
        if (searchRes && searchRes.sources.length > 0) {
          const built = buildWebResultsText(searchRes.sources, 1);
          contextBlock += built.text;
        }
      }

      await runCouncilDeliberation({
        topic,
        context: contextBlock,
        members: councilMembers,
        keys,
        signal: controller.signal,
        onUpdate: (session) => {
          councilMsg.council = { ...session };
          if (session.consensus) {
            councilMsg.text = session.consensus.synthesisText;
          }
          setCurrentConversation((prev) => {
            if (!prev || prev.id !== targetConvId) return prev;
            return {
              ...prev,
              messages: [...prev.messages],
            };
          });
        },
      });

      councilMsg.status = 'done';
      if (conv.title === 'New chat' || !conv.title) {
        conv.title = `AI Council: ${topic.slice(0, 24)}…`;
      }
      conv.updatedAt = Date.now();
      await saveConversation(conv);
      const list = await getConversationIndex();
      setConversations(list);
      setCurrentConversation({ ...conv });
      toast('AI Council reached a final verdict!', 'success');
    } catch (err: any) {
      if (controller.signal.aborted) {
        councilMsg.status = 'stopped';
        if (councilMsg.council) councilMsg.council.status = 'stopped';
      } else {
        councilMsg.status = 'error';
        councilMsg.error = err?.message || 'Council deliberation failed';
        if (councilMsg.council) {
          councilMsg.council.status = 'error';
          councilMsg.council.error = err?.message || 'Error';
        }
      }
      await saveConversation(conv);
      setCurrentConversation({ ...conv });
    } finally {
      setIsStreaming(false);
      activeAbortControllerRef.current = null;
      streamingConvIdRef.current = null;
    }
  };

  // Build available models for "Retry with…" and "Judge with…"
  const availableModels: ModelRef[] = [];
  if (keys.openai) {
    availableModels.push({ provider: 'openai', id: 'gpt-4o', label: 'GPT-4o' });
    availableModels.push({ provider: 'openai', id: 'gpt-4o-mini', label: 'GPT-4o Mini' });
  }
  if (keys.gemini) {
    availableModels.push({ provider: 'gemini', id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' });
    availableModels.push({ provider: 'gemini', id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' });
  }
  if (keys.anthropic) {
    availableModels.push({ provider: 'anthropic', id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' });
    availableModels.push({ provider: 'anthropic', id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' });
  }
  if (keys.xai) {
    availableModels.push({ provider: 'xai', id: 'grok-2-latest', label: 'Grok 2' });
  }
  if (currentModel && !availableModels.some((m) => m.provider === currentModel.provider && m.id === currentModel.id)) {
    availableModels.push(currentModel);
  }

  const openSettingsWithTab = (tab: 'keys' | 'chat' | 'data') => {
    setSettingsInitialTab(tab);
    setIsSettingsModalOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--ink)] antialiased select-text">
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        currentId={currentConvId}
        onSelectConversation={(id) => loadConversation(id)}
        onNewChat={createNewChat}
        onRenameConversation={handleRenameConv}
        onDeleteConversation={handleDeleteConv}
        onOpenSettings={() => openSettingsWithTab('keys')}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Center Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header matching Screenshot */}
        <TopBar
          currentModel={currentModel}
          keys={keys}
          onSelectModel={handleSelectModel}
          onOpenKeys={() => openSettingsWithTab('keys')}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
          isRightPanelOpen={isRightPanelOpen}
          onOpenSettings={() => openSettingsWithTab('keys')}
          theme={theme}
          onThemeToggle={handleThemeToggle}
        />

        {/* Central Chat View */}
        <ChatView
          conversation={currentConversation}
          keys={keys}
          onSendMessage={handleSendMessage}
          onSendCouncil={handleSendCouncil}
          isStreaming={isStreaming}
          onStop={handleStopStream}
          currentModel={currentModel}
          onOpenSettings={() => openSettingsWithTab('keys')}
          onRetry={handleRetry}
          onRetryWith={handleRetryWith}
          onEditUserMessage={handleEditUserMessage}
          selectedDocCount={currentConversation?.docIds.length || 0}
          onOpenDocumentsTab={() => {
            setIsRightPanelOpen(true);
            setActiveRightTab('documents');
          }}
          onOpenEmailTab={() => {
            setIsRightPanelOpen(true);
            setActiveRightTab('email');
          }}
          availableModels={availableModels}
          onUploadDroppedFiles={handleUploadDroppedFiles}
          webSearch={currentConversation?.webSearch || false}
          onToggleWebSearch={handleToggleWebSearch}
          onOpenSystemPrompt={() => openSettingsWithTab('chat')}
          onJudge={handleJudgeMessage}
          autoJudge={autoJudge}
          onToggleAutoJudge={handleToggleAutoJudge}
        />
      </div>

      {/* Right Drawer / Panel: Documents & Email */}
      <RightPanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        documents={documents}
        selectedDocIds={currentConversation?.docIds || []}
        onToggleDoc={handleToggleDoc}
        onUploadFile={handleUploadFile}
        onDeleteDoc={handleDeleteDoc}
        uploadProgress={uploadProgress}
        keys={keys}
        onOpenKeys={() => openSettingsWithTab('keys')}
        currentModel={currentModel}
        activeTab={activeRightTab}
        onTabChange={(tab) => setActiveRightTab(tab)}
      />

      {/* Keys Modal */}
      <KeysModal
        isOpen={isKeysModalOpen}
        onClose={() => setIsKeysModalOpen(false)}
        onKeysChanged={(newKeys) => setKeys(newKeys)}
        onOpenDiagnostics={() => {
          setIsKeysModalOpen(false);
          setIsDiagnosticsModalOpen(true);
        }}
      />

      {/* Settings Modal (with API Keys, Chat Settings & Data Backup) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
        keys={keys}
        autoJudge={autoJudge}
        onToggleAutoJudge={handleToggleAutoJudge}
        onKeysChanged={(newKeys) => {
          setKeys(newKeys);
          if (newKeys.tavily && currentConversation && !currentConversation.webSearch) {
            const updated = { ...currentConversation, webSearch: true, updatedAt: Date.now() };
            setCurrentConversation(updated);
            saveConversation(updated);
            toast('Tavily key saved! Web search is now active.', 'success');
          }
        }}
        theme={theme}
        onThemeChange={handleThemeChange}
        currentConversation={currentConversation}
        onUpdateConversationSettings={handleUpdateConversationSettings}
        onOpenDiagnostics={() => {
          setIsSettingsModalOpen(false);
          setIsDiagnosticsModalOpen(true);
        }}
        onDataReset={() => {
          getDocIndex().then((d) => setDocuments(d));
          getConversationIndex().then((list) => {
            setConversations(list);
            if (list.length > 0) loadConversation(list[0].id);
            else createNewChat();
          });
        }}
      />

      {/* Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        keys={keys}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ErrorBoundary>
  );
}
