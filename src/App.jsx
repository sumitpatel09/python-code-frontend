import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import "./App.css";

function App() {
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem("files");
    return saved
      ? JSON.parse(saved)
      : { "main.py": '# Write your Python code here\nprint("Hello, world!")' };
  });
  const [entryFile, setEntryFile] = useState(() => localStorage.getItem("entryFile") || "main.py");
  const [input, setInput] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState(null);
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
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  const updateFile = (filename, content) => {
    setFiles((prev) => ({ ...prev, [filename]: content }));
  };

  const switchFile = (filename) => setEntryFile(filename);

  const addFile = () => {
    const newFilename = prompt("Enter new file name (with .py):", "untitled.py");
    if (!newFilename || files[newFilename]) {
      alert("Invalid or existing file name.");
      return;
    }
    setFiles((prev) => ({ ...prev, [newFilename]: "# New file\n" }));
    setEntryFile(newFilename);
  };

  const removeFile = (filename) => {
    if (!window.confirm(`Delete '${filename}'?`)) return;
    setFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[filename];
      return newFiles;
    });
    if (entryFile === filename) {
      const remaining = Object.keys(files).filter((f) => f !== filename);
      setEntryFile(remaining.length ? remaining[0] : "");
    }
  };

  const runCode = async () => {
    setLoading(true);
    setStdout("Running...");
    setStderr("");
    setExitCode(null);
    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/run`, {
        files,
        input,
        entryFile,
      });
      setStdout(res.data.stdout || "");
      setStderr(res.data.stderr || "");
      setExitCode(res.data.exitCode);
    } catch (err) {
      setStderr("Error: " + err.message);
    }
    setLoading(false);
  };

  const shareCode = async () => {
    const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/share`, {
      files,
      entryFile,
    });
    const url = `${window.location.origin}?id=${res.data.id}`;
    await navigator.clipboard.writeText(url);
    alert("✅ Link copied to clipboard:\n" + url);
  };

  const clearOutput = () => {
    setStdout("");
    setStderr("");
    setExitCode(null);
  };

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      axios
        .get(`${import.meta.env.VITE_BACKEND_URL}/share/${id}`)
        .then((res) => {
          setFiles(res.data.files);
          setEntryFile(res.data.entryFile);
        })
        .catch(() => alert("Failed to load shared code"));
    }
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let filename = file.name.endsWith(".py") ? file.name : `${file.name}.py`;
      let base = filename;
      let count = 1;
      while (files[filename]) {
        filename = base.replace(/(\.py)?$/, `_${count}.py`);
        count++;
      }

      const content = event.target.result;
      setFiles((prev) => ({ ...prev, [filename]: content }));
      setEntryFile(filename);
    };
    reader.readAsText(file);
  };

  return (
    <div id="playground-container">
      <div className="header-bar">
        <h1>🐍 Python IDE</h1>
        <button onClick={toggleTheme}>
          {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
        </button>
      </div>

      <div className="tabs-bar">
        {Object.keys(files).map((filename) => (
          <div key={filename} className={`tab ${filename === entryFile ? "active" : ""}`}>
            <button className="tab-button" onClick={() => switchFile(filename)}>
              {filename}
            </button>
            <button className="close-button" onClick={() => removeFile(filename)}>×</button>
          </div>
        ))}
        <div className="tab add-tab" onClick={addFile}>+</div>
        <label className="upload-tab">
          📄
          <input type="file" accept=".txt" style={{ display: "none" }} onChange={handleFileUpload} />
        </label>
      </div>

      <Editor
        height="300px"
        defaultLanguage="python"
        value={currentCode}
        onChange={(val) => updateFile(entryFile, val)}
        theme={theme === "dark" ? "vs-dark" : "light"}
      />

      <div className="input-section">
        <label>🔤 Input for <code>input()</code>:</label>
        <textarea
          placeholder="Enter input values (one per line)"
          rows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      <div className="buttons-row">
        <button onClick={runCode} disabled={loading}>▶️ Run Code</button>
        <button onClick={clearOutput}>🧹 Clear Output</button>
        <button onClick={shareCode}>🔗 Share Code</button>
      </div>

      <div className="output-panel">
        <div>
          <h3>📤 stdout:</h3>
          <pre className="stdout">{stdout}</pre>
        </div>
        <div>
          <h3>❌ stderr:</h3>
          <pre className="stderr">{stderr}</pre>
        </div>
        <div>
          <h3>🚪 Exit Code:</h3>
          <pre className="exitcode">{exitCode !== null ? exitCode : loading ? "Running..." : ""}</pre>
        </div>
      </div>
    </div>
  );
}

export default App;
