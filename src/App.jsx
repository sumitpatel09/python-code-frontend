import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import "./App.css";

const BACKEND_URL = "https://python-code-backend.onrender.com";

function App() {
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem("files");
    return saved ? JSON.parse(saved) : { "main.py": '# Write your Python code here\nprint("Hello, world!")' };
  });
  const [entryFile, setEntryFile] = useState(() => localStorage.getItem("entryFile") || "main.py");
  const [input, setInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  const currentCode = files[entryFile] || "";

  useEffect(() => {
    localStorage.setItem("files", JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem("entryFile", entryFile);
  }, [entryFile]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      axios
        .get(`${BACKEND_URL}/share/${id}`)
        .then((res) => {
          setFiles(res.data.files);
          setEntryFile(res.data.entryFile);
        })
        .catch(() => alert("Failed to load shared code"));
    }
  }, []);

  const updateFile = (filename, content) => {
    setFiles((prev) => ({ ...prev, [filename]: content }));
  };

  const switchFile = (filename) => {
    setEntryFile(filename);
  };

  const addFile = () => {
    const newFilename = prompt("Enter new file name (with .py):", "untitled.py");
    if (!newFilename) return;
    if (files[newFilename]) {
      alert("File already exists!");
      return;
    }
    setFiles((prev) => ({ ...prev, [newFilename]: "# New file\n" }));
    setEntryFile(newFilename);
  };

  const renameFile = (oldName) => {
    const newName = prompt("Enter new filename (with .py):", oldName);
    if (!newName || newName === oldName) return;
    if (files[newName]) {
      alert("A file with that name already exists.");
      return;
    }

    setFiles((prev) => {
      const updated = { ...prev };
      updated[newName] = updated[oldName];
      delete updated[oldName];
      return updated;
    });

    if (entryFile === oldName) {
      setEntryFile(newName);
    }
  };

  const removeFile = (filename) => {
    if (!window.confirm(`Are you sure you want to delete '${filename}'?`)) return;
    setFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[filename];
      return newFiles;
    });
    if (entryFile === filename) {
      const remainingFiles = Object.keys(files).filter((f) => f !== filename);
      setEntryFile(remainingFiles.length ? remainingFiles[0] : "");
    }
  };

  const runCode = async () => {
    setLoading(true);
    setTerminalOutput(`$ python ${entryFile}\n${input ? input.split("\n").map(line => `> ${line}`).join("\n") + "\n" : ""}`);
    try {
      const res = await axios.post(`${BACKEND_URL}/run`, {
        files,
        input,
        entryFile,
      });

      const { stdout, stderr, exitCode } = res.data;
      const output =
        `${stdout || ""}` +
        `${stderr ? `\nError:\n${stderr}` : ""}` +
        `\n\n[Process exited with code ${exitCode}]`;

      setTerminalOutput((prev) => prev + output);
    } catch (err) {
      setTerminalOutput((prev) => prev + "\nError: " + err.message);
    }
    setLoading(false);
  };

  const clearOutput = () => {
    setTerminalOutput("");
  };

  const shareCode = async () => {
    const res = await axios.post(`${BACKEND_URL}/share`, {
      files,
      entryFile,
    });
    const url = `${window.location.origin}?id=${res.data.id}`;
    await navigator.clipboard.writeText(url);
    alert("✅ Link copied to clipboard:\n" + url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let filename = file.name.endsWith(".py") ? file.name : `${file.name}.py`;
      const content = event.target.result;
      setFiles((prev) => ({ ...prev, [filename]: content }));
      setEntryFile(filename);
    };
    reader.readAsText(file);
  };

  return (
    <div id="playground-container">
      <div className="header-bar">
        <h2>🐍 Python Online IDE</h2>
        <button onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}>
          Toggle {theme === "dark" ? "Light" : "Dark"} Mode
        </button>
      </div>

      <div className="tabs-bar">
        {Object.keys(files).map((filename) => (
          <div
            key={filename}
            className={`tab ${filename === entryFile ? "active" : ""}`}
            onClick={() => switchFile(filename)}
          >
            {filename}
            <button className="rename-button" title="Rename" onClick={(e) => { e.stopPropagation(); renameFile(filename); }}>✏️</button>
            <button className="rename-button" title="Delete" onClick={(e) => { e.stopPropagation(); removeFile(filename); }}>❌</button>
          </div>
        ))}
        <div className="tab upload-tab">
          <label>
            📂 Upload
            <input type="file" accept=".py" onChange={handleFileUpload} />
          </label>
        </div>
        <button onClick={addFile}>➕ Add File</button>
      </div>

      <Editor
        height="400px"
        defaultLanguage="python"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={currentCode}
        onChange={(value) => updateFile(entryFile, value)}
      />

      <div className="input-section">
        <label htmlFor="input">Input (stdin):</label>
        <textarea
          rows="4"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter input for your code (if needed)"
        />
      </div>

      <div className="buttons-row">
        <button onClick={runCode} disabled={loading}>
          ▶️ {loading ? "Running..." : "Run Code"}
        </button>
        <button onClick={clearOutput}>🧹 Clear Output</button>
        <button onClick={shareCode}>🔗 Share</button>
      </div>

      <div className="output-panel">
        <h4>Terminal Output</h4>
        <pre>{terminalOutput}</pre>
      </div>
    </div>
  );
}

export default App;
