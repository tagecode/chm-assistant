#include <napi.h>

#include <cstdint>
#include <iomanip>
#include <mutex>
#include <random>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

extern "C" {
#include "chm_lib.h"
}

static std::mutex g_mutex;
static std::unordered_map<std::string, struct chmFile*> g_sessions;

static std::string RandomSessionId() {
  static thread_local std::mt19937_64 rng{std::random_device{}()};
  std::uniform_int_distribution<uint64_t> dist;
  std::stringstream ss;
  ss << std::hex << std::setfill('0') << std::setw(16) << dist(rng) << std::setw(16) << dist(rng);
  return ss.str();
}

static std::string NormalizeInternalPath(const std::string& path) {
  std::string out;
  out.reserve(path.size() + 2);
  for (char c : path) {
    if (c == '\\') {
      out.push_back('/');
    } else if (c != '\0') {
      out.push_back(c);
    }
  }
  if (out.empty() || out.front() != '/') {
    out.insert(out.begin(), '/');
  }
  return out;
}

static bool PathHasParentTraversal(const std::string& normalized) {
  size_t i = 0;
  if (!normalized.empty() && normalized[0] == '/') {
    i = 1;
  }
  while (i < normalized.size()) {
    size_t j = normalized.find('/', i);
    std::string seg =
        normalized.substr(i, j == std::string::npos ? std::string::npos : j - i);
    if (seg == "..") {
      return true;
    }
    if (j == std::string::npos) {
      break;
    }
    i = j + 1;
  }
  return false;
}

static struct chmFile* FindSession(const std::string& id) {
  auto it = g_sessions.find(id);
  if (it == g_sessions.end()) {
    return nullptr;
  }
  return it->second;
}

static int EnumerateCallback(struct chmFile*, struct chmUnitInfo* ui, void* context) {
  auto* out = static_cast<std::vector<std::string>*>(context);
  if (ui->path[0] != '\0') {
    out->emplace_back(ui->path);
  }
  return CHM_ENUMERATOR_CONTINUE;
}

static constexpr int64_t kMaxObjectBytes = 32 * 1024 * 1024;

static Napi::Value OpenChm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "expected string path").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string fspath = info[0].As<Napi::String>().Utf8Value();

  struct chmFile* h = chm_open(fspath.c_str());
  Napi::Object res = Napi::Object::New(env);
  if (h == nullptr) {
    res.Set("ok", false);
    res.Set("error", "chm_open failed");
    return res;
  }

  std::string id = RandomSessionId();
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    while (g_sessions.find(id) != g_sessions.end()) {
      id = RandomSessionId();
    }
    g_sessions[id] = h;
  }
  res.Set("ok", true);
  res.Set("sessionId", id);
  return res;
}

static void CloseChm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "expected session id").ThrowAsJavaScriptException();
    return;
  }
  std::string id = info[0].As<Napi::String>().Utf8Value();
  struct chmFile* h = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_sessions.find(id);
    if (it != g_sessions.end()) {
      h = it->second;
      g_sessions.erase(it);
    }
  }
  if (h != nullptr) {
    chm_close(h);
  }
}

static Napi::Value ListPaths(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "expected session id").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string id = info[0].As<Napi::String>().Utf8Value();
  struct chmFile* h = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    h = FindSession(id);
  }
  Napi::Object res = Napi::Object::New(env);
  if (h == nullptr) {
    res.Set("ok", false);
    res.Set("error", "unknown session");
    return res;
  }
  std::vector<std::string> paths;
  /* CHM_ENUMERATE_FILES 单独使用时 what&0x7==0，会跳过全部项；需包含 NORMAL/SPECIAL/META 等类型位。 */
  int rv = chm_enumerate(h, CHM_ENUMERATE_ALL, EnumerateCallback, &paths);
  if (rv == 0) {
    res.Set("ok", false);
    res.Set("error", "enumerate failed");
    return res;
  }
  Napi::Array arr = Napi::Array::New(env, paths.size());
  for (size_t i = 0; i < paths.size(); i++) {
    arr.Set(static_cast<uint32_t>(i), paths[i]);
  }
  res.Set("ok", true);
  res.Set("paths", arr);
  return res;
}

static Napi::Value ReadObject(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "expected session id and object path").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string id = info[0].As<Napi::String>().Utf8Value();
  std::string rawPath = info[1].As<Napi::String>().Utf8Value();

  std::string norm = NormalizeInternalPath(rawPath);
  if (PathHasParentTraversal(norm)) {
    Napi::Object bad = Napi::Object::New(env);
    bad.Set("ok", false);
    bad.Set("error", "invalid path");
    return bad;
  }

  struct chmFile* h = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    h = FindSession(id);
  }
  Napi::Object res = Napi::Object::New(env);
  if (h == nullptr) {
    res.Set("ok", false);
    res.Set("error", "unknown session");
    return res;
  }

  struct chmUnitInfo ui {};
  if (chm_resolve_object(h, norm.c_str(), &ui) != CHM_RESOLVE_SUCCESS) {
    res.Set("ok", false);
    res.Set("error", "not found");
    return res;
  }

  if (ui.length > static_cast<LONGUINT64>(kMaxObjectBytes)) {
    res.Set("ok", false);
    res.Set("error", "object too large");
    return res;
  }

  size_t len = static_cast<size_t>(ui.length);
  std::vector<unsigned char> buf(len);
  LONGINT64 got =
      len == 0 ? 0 : chm_retrieve_object(h, &ui, buf.data(), 0, static_cast<LONGINT64>(len));
  if (got != static_cast<LONGINT64>(len)) {
    res.Set("ok", false);
    res.Set("error", "read failed");
    return res;
  }

  res.Set("ok", true);
  res.Set("data", Napi::Buffer<unsigned char>::Copy(env, buf.data(), len));
  return res;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("openChm", Napi::Function::New(env, OpenChm));
  exports.Set("closeChm", Napi::Function::New(env, CloseChm));
  exports.Set("listPaths", Napi::Function::New(env, ListPaths));
  exports.Set("readObject", Napi::Function::New(env, ReadObject));
  return exports;
}

NODE_API_MODULE(chm_addon, Init)
