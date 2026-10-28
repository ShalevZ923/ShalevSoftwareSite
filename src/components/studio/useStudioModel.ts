import { useDocumentModel } from "./useDocumentModel";
import { useDraft } from "./useDraft";
import { decodeToolEntries, decodeToolEntry, studioResponse, StudioApiError } from "./api";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { ToolEntryPayload } from "./types";
import { getToolValidationRecovery, type ValidationRecovery } from "./saveValidation";

const defaultNewTool: ToolEntryPayload = {
  id: "new-tool",
  metadata: {
    id: "new-tool",
    order: 1,
    name: "New Software",
    company: "Internal Team",
    category: "Development",
    platforms: ["Windows"],
    lifecycle: "Current",
    icon: "NS",
    updated: new Date().toISOString().slice(0, 10),
    description: "Brief summary of the approved software.",
    support: {
      name: "Platform Owner",
      team: "Platform Engineering",
      initials: "PO",
      email: "support@atlas.local",
    },
    releases: [
      {
        version: "1.0.0",
        download: "https://example.com/downloads/v1.0.0",
      },
    ],
    tags: ["Utility"],
  },
  guide: `# New Software\n\nBrief summary of the approved software.\n\n## Install\n\n1. Download the approved release.\n2. Run the installer with organizational defaults.\n\n## Support\n\nPlatform Engineering supports the base installation and access.`,
};

export function useStudioModel({
  token,
  onExit,
  onCatalogUpdated,
  onDraftStateChange,
}: {
  token: string;
  onExit: () => void;
  onCatalogUpdated: () => void;
  onDraftStateChange: (dirty: boolean, saving: boolean) => void;
}) {
  const [agentDirty, setAgentDirty] = useState(false);
  const [agentSaving, setAgentSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"tools" | "docs" | "agents">("tools");
  const [toolsList, setToolsList] = useState<ToolEntryPayload[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const toolDraft = useDraft<ToolEntryPayload | null>(null);
  const editingTool = toolDraft.draft;
  const setEditingTool = toolDraft.edit;
  const [toolSearch, setToolSearch] = useState("");
  const [isCreatingNewTool, setIsCreatingNewTool] = useState(false);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);

  const [guideLibraryFiles, setGuideLibraryFiles] = useState<string[]>([]);
  const [guideLibraryStatus, setGuideLibraryStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [guideLibraryRevision, setGuideLibraryRevision] = useState(0);

  const [guideViewMode, setGuideViewMode] = useState<"split" | "edit" | "preview">("split");

  const [conflictDraft, setConflictDraft] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState("Overview");
  const [validationRecovery, setValidationRecovery] = useState<ValidationRecovery | null>(null);

  const [loadingTools, setLoadingTools] = useState(true);

  const statusRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (statusMessage?.tone !== "error") return;
    const target = validationRecovery
      ? document.querySelector<HTMLElement>(
          `[data-validation-field="${validationRecovery.field}"]`,
        ) ||
        document.querySelector<HTMLElement>(
          `[data-validation-section="${validationRecovery.section}"]`,
        )
      : statusRef.current;
    requestAnimationFrame(() => target?.focus());
  }, [statusMessage, validationRecovery]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      if (media.matches) {
        setGuideViewMode((mode) => (mode === "split" ? "edit" : mode));
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const headers = useMemo(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const {
    docsList,
    selectedDocName,
    editingDocContent,
    setEditingDocContent,
    docViewMode,
    setDocViewMode,
    docSearch,
    setDocSearch,
    loadingDocs,
    loadingDoc,
    docDirty,
    loadDocs,
    handleSelectDoc,
    handleSaveDoc,
  } = useDocumentModel({ headers, isSaving, setIsSaving, setStatusMessage });
  const toolDirty = !!editingTool && (isCreatingNewTool || toolDraft.dirty);

  const dirty = toolDirty || docDirty || agentDirty;
  const canDiscard = (hasChanges: boolean) =>
    !isSaving && !agentSaving && (!hasChanges || window.confirm("Discard unsaved changes?"));
  useEffect(() => {
    onDraftStateChange(dirty, isSaving || agentSaving);
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty || isSaving || agentSaving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, isSaving, agentSaving, onDraftStateChange]);
  const switchWorkspace = (tab: "tools" | "docs" | "agents") => {
    if (!canDiscard(activeTab === "agents" && agentDirty)) return;
    setActiveTab(tab);
    setStatusMessage(null);
    setValidationRecovery(null);
  };

  // Load all tools from developer API
  const loadTools = async (selectInitial = true) => {
    setLoadingTools(true);
    try {
      const res = await fetch("/api/developer/tools", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load tools: ${res.statusText}`);
      }
      const data = await studioResponse(res, decodeToolEntries);
      setToolsList(data);
      if (
        selectInitial &&
        data.length > 0 &&
        (!editingTool ||
          window.confirm(
            "Replace this draft with the saved version? Copy any changes you need before reloading.",
          ))
      ) {
        const refreshed = data.find((entry) => entry.id === selectedToolId) ?? data[0];
        setSelectedToolId(refreshed.id);
        toolDraft.load(structuredClone(refreshed));
      }
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error loading tools",
      });
    } finally {
      setLoadingTools(false);
    }
  };

  // Load docs list from developer API

  const loadInitialLists = useEffectEvent(() => {
    void loadTools();
    void loadDocs();
  });
  useEffect(() => {
    loadInitialLists();
  }, [headers]);

  useEffect(() => {
    setGuideLibraryFiles([]);
    if (!selectedToolId) {
      setGuideLibraryStatus("ready");
      return;
    }
    setGuideLibraryStatus("loading");
    const controller = new AbortController();
    fetch(`/api/developer/guide-library/${encodeURIComponent(selectedToolId)}`, {
      headers,
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load guide library");
        return res.json();
      })
      .then((files: string[]) => {
        if (!Array.isArray(files) || files.some((file) => typeof file !== "string"))
          throw new Error("Invalid guide library response");
        if (!controller.signal.aborted) {
          setGuideLibraryFiles(files);
          setGuideLibraryStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setGuideLibraryStatus("error");
      });
    return () => controller.abort();
  }, [headers, selectedToolId, guideLibraryRevision]);

  // Select tool
  const handleSelectTool = (tool: ToolEntryPayload) => {
    if (!canDiscard(toolDirty)) return;
    setIsCreatingNewTool(false);
    setSelectedToolId(tool.id);
    toolDraft.load(structuredClone(tool));

    setSection("Overview");
    setStatusMessage(null);
    setValidationRecovery(null);
    setToolPickerOpen(false);
  };

  // Select doc

  // Start new tool
  const handleStartNewTool = () => {
    if (!canDiscard(toolDirty)) return;
    setSection("Overview");
    const nextOrder =
      toolsList.reduce((max, item) => Math.max(max, item.metadata.order || 0), 0) + 1;
    const freshTool: ToolEntryPayload = JSON.parse(JSON.stringify(defaultNewTool));
    freshTool.metadata.order = nextOrder;
    setIsCreatingNewTool(true);
    setSelectedToolId("");
    setEditingTool(freshTool);
    setStatusMessage(null);
    setValidationRecovery(null);
    setToolPickerOpen(false);
  };

  // Save Tool Changes
  const handleSaveTool = async () => {
    if (!editingTool || isSaving) return;
    setIsSaving(true);
    setStatusMessage({ tone: "info", text: "Validating and saving tool..." });

    try {
      const endpoint = isCreatingNewTool
        ? "/api/developer/tools"
        : `/api/developer/tools/${editingTool.id}`;
      const method = isCreatingNewTool ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          metadata: editingTool.metadata,
          guide: editingTool.guide,
          revision: editingTool.revision,
        }),
      });

      const result = await studioResponse(res, (value) => {
        const entry = decodeToolEntry((value as { entry: unknown }).entry);
        return { entry };
      });
      toolDraft.load(result.entry);

      setStatusMessage({
        tone: "success",
        text: `Successfully saved ${editingTool.metadata.name}! Catalog regenerated.`,
      });
      setValidationRecovery(null);

      setIsCreatingNewTool(false);
      setSelectedToolId(editingTool.id);
      await loadTools(false);
      await onCatalogUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      if (
        err instanceof StudioApiError &&
        ["REVISION_CONFLICT", "REVISION_REQUIRED"].includes(err.code ?? "")
      ) {
        setConflictDraft(JSON.stringify(editingTool, null, 2));
        setValidationRecovery(null);
        setStatusMessage({ tone: "error", text: message });
        return;
      }
      const recovery = getToolValidationRecovery(
        message,
        err instanceof StudioApiError ? err.field : undefined,
      );
      setSection(recovery.section);
      setValidationRecovery(recovery);
      setStatusMessage({
        tone: "error",
        text: `${message}. ${recovery.guidance}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Save Document

  const filteredTools = useMemo(() => {
    const q = toolSearch.trim().toLowerCase();
    if (!q) return toolsList;
    return toolsList.filter(
      (t) =>
        t.metadata.name.toLowerCase().includes(q) ||
        t.metadata.category.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [toolsList, toolSearch]);

  return {
    activeTab,
    setAgentDirty,
    setAgentSaving,
    switchWorkspace,
    toolsList,
    docsList,
    onExit,
    statusMessage,
    statusRef,
    validationRecovery,
    loadTools,
    loadDocs,
    setStatusMessage,
    setValidationRecovery,
    conflictDraft,
    selectedToolId,
    headers,
    setConflictDraft,
    editingTool,
    toolSearch,
    setToolSearch,
    isSaving,
    loadingTools,
    handleStartNewTool,
    toolPickerOpen,
    setToolPickerOpen,
    filteredTools,
    isCreatingNewTool,
    handleSelectTool,
    toolDirty,
    handleSaveTool,
    section,
    setSection,
    setEditingTool,
    guideLibraryFiles,
    guideLibraryStatus,
    setGuideLibraryRevision,
    guideViewMode,
    setGuideViewMode,
    docSearch,
    setDocSearch,
    loadingDocs,
    selectedDocName,
    handleSelectDoc,
    loadingDoc,
    docDirty,
    handleSaveDoc,
    docViewMode,
    setDocViewMode,
    editingDocContent,
    setEditingDocContent,
  };
}
