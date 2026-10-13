import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import { decodeDocList } from "../../contracts";
import { useDraft } from "./useDraft";
import { studioResponse } from "./api";
type DocFile = { name: string; sizeBytes: number; modified: string };
type Status = { tone: "success" | "error" | "info"; text: string };
export function useDocumentModel({
  headers,
  isSaving,
  setIsSaving,
  setStatusMessage,
}: {
  headers: Record<string, string>;
  isSaving: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setStatusMessage: Dispatch<SetStateAction<Status | null>>;
}) {
  const [docsList, setDocsList] = useState<DocFile[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string>("");
  const docDraft = useDraft("");
  const editingDocContent = docDraft.draft;
  const setEditingDocContent = docDraft.edit;
  const [docRevision, setDocRevision] = useState("");
  const [docViewMode, setDocViewMode] = useState<"split" | "edit" | "preview">("split");
  const [docSearch, setDocSearch] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const docRequest = useRef(0);
  const docDirty = !!selectedDocName && docDraft.dirty;
  const loadDocs = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/developer/docs", { headers });
      if (!res.ok) {
        throw new Error(`Failed to load docs: ${res.statusText}`);
      }
      const data = decodeDocList(await res.json());
      setDocsList(data);
      if (data.length > 0 && !selectedDocName) {
        loadSingleDoc(data[0].name);
      }
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error loading docs",
      });
    } finally {
      setLoadingDocs(false);
    }
  };
  const loadSingleDoc = async (docName: string) => {
    const request = ++docRequest.current;
    setLoadingDoc(true);
    try {
      const res = await fetch(`/api/developer/docs/${encodeURIComponent(docName)}`, { headers });
      if (!res.ok) throw new Error("Failed to load document");
      const data = await res.json();
      if (request !== docRequest.current) return;
      if (typeof data.content !== "string" || typeof data.revision !== "string")
        throw new Error("Invalid document response");
      docDraft.load(data.content);
      setDocRevision(data.revision);

      setSelectedDocName(docName);
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Error reading document",
      });
    } finally {
      if (request === docRequest.current) setLoadingDoc(false);
    }
  };
  const handleSelectDoc = (docName: string) => {
    if (isSaving || (docDirty && !window.confirm("Discard unsaved changes?"))) return;
    loadSingleDoc(docName);
    setStatusMessage(null);
  };
  const handleSaveDoc = async () => {
    if (!selectedDocName || isSaving || loadingDoc) return;
    setIsSaving(true);
    setStatusMessage({ tone: "info", text: "Saving documentation..." });

    try {
      const res = await fetch(`/api/developer/docs/${encodeURIComponent(selectedDocName)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ content: editingDocContent, revision: docRevision }),
      });
      const result = await studioResponse(res, (value) => {
        const item = value as { revision: string };
        if (typeof item.revision !== "string") throw new Error("Invalid save response");
        return item;
      });
      setDocRevision(result.revision);
      docDraft.saved(editingDocContent);
      setStatusMessage({
        tone: "success",
        text: `Successfully saved docs/${selectedDocName}!`,
      });

      await loadDocs();
    } catch (err: unknown) {
      setStatusMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to save doc",
      });
    } finally {
      setIsSaving(false);
    }
  };
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    const update = () => {
      if (media.matches) setDocViewMode((mode) => (mode === "split" ? "edit" : mode));
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return {
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
  };
}
