import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleCheck,
  FileCheck2,
  FileSearch,
  Fingerprint,
  GitBranch,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/">
          <Brand />
        </Link>
        <nav>
          <a href="#workflow">How it works</a>
          <a href="#evidence">Evidence intelligence</a>
          <Link href="/verify">
            Verify a report <ArrowUpRight size={12} />
          </Link>
        </nav>
        <div>
          <Link className="sign-in" href="/login">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/login">
              Launch demo <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span />
              VERIFIABLE COMPLIANCE INTELLIGENCE
            </div>
            <h1>
              Compliance intelligence
              <br />
              you can <span>verify.</span>
            </h1>
            <p>
              Bring fragmented evidence into focus. Evaluate digital asset
              issuer readiness with grounded AI, transparent policy rules, and
              verifiable audit records.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/login">
                  Launch demo <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="#workflow">
                  Explore how it works <ArrowUpRight size={17} />
                </a>
              </Button>
            </div>
            <div className="hero-assurances">
              <span>
                <Check size={14} />
                Evidence-backed decisions
              </span>
              <span>
                <Check size={14} />
                Human review built in
              </span>
              <span>
                <Check size={14} />
                Independent verification
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustrative evidence-to-verification workflow"
          >
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="hero-core">
              <Fingerprint size={68} />
              <strong>REGGUARD</strong>
              <small>CHAIN OF EVIDENCE</small>
            </div>
            <div className="floating-evidence top">
              <span className="floating-icon">
                <FileSearch size={20} />
              </span>
              <div>
                <strong>Original evidence</strong>
                <small>Document + source provenance</small>
              </div>
              <span className="connection-dot" />
            </div>
            <div className="floating-evidence bottom">
              <span className="floating-icon purple">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>Explainable findings</strong>
                <small>Every outcome has a reason</small>
              </div>
            </div>
            <div className="floating-proof">
              <ShieldCheck size={18} />
              <span>Integrity, independently checked</span>
            </div>
            <span className="visual-caption">
              PRODUCT WORKFLOW ILLUSTRATION
            </span>
          </div>
        </section>
        <div className="technology-ribbon">
          <span>ONE CONNECTED EVIDENCE LIFECYCLE</span>
          <strong>
            <FileSearch size={19} />
            Documents
          </strong>
          <i>+</i>
          <strong>
            <Sparkles size={19} />
            AI extraction
          </strong>
          <i>+</i>
          <strong>
            <GitBranch size={19} />
            Policy rules
          </strong>
          <i>+</i>
          <strong>
            <Fingerprint size={19} />
            Verifiable audits
          </strong>
        </div>
        <section id="workflow" className="landing-section workflow-section">
          <div className="section-intro">
            <div>
              <span className="eyebrow">LESS FRAGMENTATION. MORE CLARITY.</span>
              <h2>
                One case.
                <br />A complete chain of evidence.
              </h2>
            </div>
            <p>
              Built for digital asset issuer onboarding. Move from supporting
              documents to an inspectable readiness assessment without losing
              the source behind a decision.
            </p>
          </div>
          <div className="workflow-cards">
            {[
              {
                n: "01",
                icon: FileSearch,
                title: "Collect & connect",
                copy: "Bring legal entity records, issuer documents, and blockchain identifiers into one private case.",
              },
              {
                n: "02",
                icon: Sparkles,
                title: "Extract & evaluate",
                copy: "Inspect cited document fields. Apply eight deterministic checks against a specific policy version.",
              },
              {
                n: "03",
                icon: FileCheck2,
                title: "Review & preserve",
                copy: "Resolve uncertainty with attributable human review. Finalize an immutable evidence package.",
              },
              {
                n: "04",
                icon: Fingerprint,
                title: "Commit & verify",
                copy: "Anchor a private, salted commitment on Sepolia when configured. Verify the artifact independently.",
              },
            ].map((step) => (
              <article key={step.n}>
                <div>
                  <step.icon size={24} />
                  <span>{step.n}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="evidence" className="landing-section evidence-section">
          <div className="evidence-preview">
            <div className="preview-top">
              <span>
                <span className="preview-dot" />
                Evidence inspector
              </span>
              <small>ILLUSTRATIVE SAMPLE</small>
            </div>
            <div className="preview-split">
              <div className="preview-document">
                <div className="document-lines">
                  <span />
                  <span />
                  <span />
                </div>
                <h4>Issuer declaration</h4>
                <p>Document type: issuer_declaration</p>
                <mark>Entity: Aurora Digital Assets Ltd</mark>
                <p>Fictional demonstration evidence.</p>
                <div className="document-lines">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className="page-number">1 / 1</span>
              </div>
              <div className="preview-finding">
                <span className="mini-badge">R03 / ENTITY MATCH</span>
                <h3>
                  A finding.
                  <br />
                  With its source.
                </h3>
                <div className="sample-reference">
                  <FileSearch size={15} />
                  <span>
                    Source excerpt located
                    <br />
                    <small>issuer_declaration.pdf / page 1</small>
                  </span>
                </div>
                <hr />
                <small>RULE OUTCOME</small>
                <p>
                  Normalized names are compared against the reference record.
                  Ambiguity is routed to a reviewer.
                </p>
                <span className="preview-source">
                  Evidence before interpretation.
                </span>
              </div>
            </div>
          </div>
          <div className="evidence-copy">
            <span className="eyebrow">AI YOU CAN INSPECT</span>
            <h2>
              Don&apos;t just read
              <br />
              the answer.
              <br />
              <span>See the evidence.</span>
            </h2>
            <p>
              Every extracted field carries a document reference and a
              supporting excerpt. AI helps read the evidence; a separate rule
              engine evaluates the policy.
            </p>
            <ul>
              <li>
                <CircleCheck size={17} />
                Original documents beside findings
              </li>
              <li>
                <CircleCheck size={17} />
                Source timestamps and immutable snapshots
              </li>
              <li>
                <CircleCheck size={17} />
                Uncertainty stays visible
              </li>
            </ul>
            <Link href="/login">
              Explore the evidence inspector <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="landing-section verification-section">
          <div>
            <span className="eyebrow">TRUST, WITH A WAY TO CHECK</span>
            <h2>
              The report can leave your workspace.
              <br />
              Its integrity goes with it.
            </h2>
            <p>
              A canonical report, a private random salt, and a public
              commitment. Recompute the fingerprint locally and compare it with
              the registry you trust.
            </p>
            <Button asChild variant="secondary">
              <Link href="/verify">
                Try independent verification <ArrowUpRight size={17} />
              </Link>
            </Button>
          </div>
          <div className="commitment-diagram">
            <div>
              <FileCheck2 size={20} />
              <span>Finalized report</span>
            </div>
            <b>+</b>
            <div>
              <LockKeyhole size={20} />
              <span>Private salt</span>
            </div>
            <b>SHA-256</b>
            <div className="commitment-output">
              <Fingerprint size={23} />
              <span>Verifiable commitment</span>
              <ShieldCheck size={18} />
            </div>
            <small>
              Only commitments go on-chain. Your documents remain private.
            </small>
          </div>
        </section>
        <section className="landing-section architecture-section">
          <div className="section-intro">
            <div>
              <span className="eyebrow">PURPOSEFUL BY DESIGN</span>
              <h2>Each layer has a clear responsibility.</h2>
            </div>
          </div>
          <div className="architecture-rows">
            {[
              [
                "01",
                "AI extraction",
                "Grounded structured fields, validated citations, explicit uncertainty.",
              ],
              [
                "02",
                "Policy engine",
                "Reproducible rules. Versioned policies. No LLM approval decisions.",
              ],
              [
                "03",
                "Source orchestration",
                "GLEIF and EVM connectors; a separate CRE workflow with explicit execution provenance.",
              ],
              [
                "04",
                "Integrity registry",
                "Append-only commitments and an independent browser / CLI verifier.",
              ],
            ].map((row) => (
              <div key={row[0]}>
                <span>{row[0]}</span>
                <h3>{row[1]}</h3>
                <p>{row[2]}</p>
                <Layers3 size={19} />
              </div>
            ))}
          </div>
        </section>
        <section className="landing-section faq-section">
          <div>
            <span className="eyebrow">CLEAR ANSWERS</span>
            <h2>
              Know what a result
              <br />
              really means.
            </h2>
          </div>
          <div>
            {[
              [
                "Does a PASS certify legal compliance?",
                "No. PASS means one identified rule in the selected internal readiness policy was satisfied with specific evidence at a recorded time. Legal judgment and regulatory certification remain outside this product.",
              ],
              [
                "What happens when a source is unavailable?",
                "Required evidence stays unknown. A missing or failed API response cannot silently become a passing check.",
              ],
              [
                "Is the demo connected to live AI and blockchain services?",
                "The local demo uses clearly labeled fictional documents and simulated sources. Live OpenAI, Supabase, RPC, and anchoring require configuration. CRE execution and testnet deployment are reported separately.",
              ],
              [
                "Can I verify a report without trusting the backend?",
                "Yes. The exported JSON package contains the report and private salt. The browser and standalone verifier recompute the commitment locally. On-chain authenticity also requires an independently trusted registry and a reachable RPC.",
              ],
              [
                "What data is written on-chain?",
                "A random record identifier, salted report commitment, policy hash, timestamp, and submitter. Original documents and legal entity details are not written to the registry.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <Fingerprint size={34} />
          <h2>Make every decision traceable.</h2>
          <p>Explore an evidence-first compliance workflow.</p>
          <Button asChild>
            <Link href="/login">
              Launch RegGuard demo <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <p>AI-powered compliance intelligence. Evidence-backed decisions.</p>
        <div>
          <Link href="/verify">Verify a report</Link>
          <Link href="/login">Open workspace</Link>
        </div>
        <small>
          RegGuard AI / Hackathon implementation / Not legal advice or
          certification.
        </small>
      </footer>
    </div>
  );
}
