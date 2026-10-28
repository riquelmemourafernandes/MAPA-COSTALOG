import assert from "node:assert/strict";
import test from "node:test";
import { submitAccessRequest, type AccessRequestRepository, type PendingAccessAccount } from "./access-requests.js";

const valid = { name: "  Maria Silva  ", email: "MARIA@EXAMPLE.COM", password: "senha-segura-123" };

function repository(existing = false) {
  const created: PendingAccessAccount[] = [];
  const repo: AccessRequestRepository = {
    async emailExists() { return existing; },
    async createPendingUser(account) { created.push(account); }
  };
  return { repo, created };
}

test("solicitação cria apenas conta inativa de consulta, com senha em hash", async () => {
  const { repo, created } = repository();
  const result = await submitAccessRequest(valid, repo, async () => "hash-irreversivel");
  assert.equal(result, "accepted");
  assert.deepEqual(created, [{
    name: "Maria Silva", email: "maria@example.com", passwordHash: "hash-irreversivel",
    role: "CONSULTA", active: false
  }]);
});

test("não aceita perfil ADMIN ou active=true enviados pelo navegador", async () => {
  const { repo, created } = repository();
  assert.equal(await submitAccessRequest({ ...valid, role: "ADMIN" }, repo), "invalid");
  assert.equal(await submitAccessRequest({ ...valid, active: true }, repo), "invalid");
  assert.equal(created.length, 0);
});

test("não cria usuário com campos inválidos ou senha curta", async () => {
  const { repo, created } = repository();
  assert.equal(await submitAccessRequest({ ...valid, password: "123456789" }, repo), "invalid");
  assert.equal(await submitAccessRequest({ ...valid, email: "email-invalido" }, repo), "invalid");
  assert.equal(await submitAccessRequest({ ...valid, name: "A" }, repo), "invalid");
  assert.equal(created.length, 0);
});

test("não altera usuário existente nem revela a existência da conta", async () => {
  const { repo, created } = repository(true);
  assert.equal(await submitAccessRequest(valid, repo), "accepted");
  assert.equal(created.length, 0);
});

test("concorrência em e-mail duplicado retorna resposta indistinguível", async () => {
  const repo: AccessRequestRepository = {
    async emailExists() { return false; },
    async createPendingUser() { throw { code: "P2002" }; }
  };
  assert.equal(await submitAccessRequest(valid, repo, async () => "hash"), "accepted");
});

test("erros do banco não são mascarados como sucesso", async () => {
  const repo: AccessRequestRepository = {
    async emailExists() { return false; },
    async createPendingUser() { throw new Error("database offline"); }
  };
  await assert.rejects(submitAccessRequest(valid, repo, async () => "hash"), /database offline/);
});
