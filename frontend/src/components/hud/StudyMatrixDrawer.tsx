"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, GraduationCap, Award, Sparkles, RotateCcw, 
  CheckCircle2, XCircle, ChevronRight, ChevronLeft, 
  Lightbulb, Layers, BrainCircuit, BookOpen, Compass
} from 'lucide-react';

interface StudyMatrixDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  discipline: string;
}

const QUIZ_BANK: Record<string, QuizQuestion[]> = {
  ai: [
    {
      id: 1,
      question: "What is the primary role of the Attention mechanism in Transformer neural architectures?",
      options: [
        "Compressing input tokens into a single fixed-length vector",
        "Dynamically weighting the relevance of every token relative to other tokens in the context",
        "Applying convolutional filters to find spatial patterns in text",
        "Generating synthetic audio wave forms directly from characters"
      ],
      correctIndex: 1,
      explanation: "Self-attention computes dynamic affinity scores between all token pairs, allowing the model to focus on contextually relevant tokens regardless of their positional distance.",
      discipline: "Artificial Intelligence"
    },
    {
      id: 2,
      question: "In Reinforcement Learning from Human Feedback (RLHF), what is the function of the Reward Model?",
      options: [
        "To tokenize incoming audio signals",
        "To predict human preference rankings of generated responses to steer policy optimization",
        "To purge hallucinated weights during backpropagation",
        "To encrypt model weights at rest"
      ],
      correctIndex: 1,
      explanation: "The Reward Model is trained on human pairwise comparisons to output a scalar score representing response quality, which guides PPO or DPO fine-tuning.",
      discipline: "Artificial Intelligence"
    },
    {
      id: 3,
      question: "What distinguishes Retrieval-Augmented Generation (RAG) from model fine-tuning?",
      options: [
        "RAG permanently updates model weight matrices",
        "RAG retrieves authoritative external documents at inference time to ground responses without retraining",
        "RAG cannot be used with vector databases",
        "RAG requires quantum annealing hardware"
      ],
      correctIndex: 1,
      explanation: "RAG grounds the model in dynamic, verifiable knowledge by querying an external vector index and passing retrieved passages into the prompt context.",
      discipline: "Artificial Intelligence"
    }
  ],
  quantum: [
    {
      id: 1,
      question: "What quantum principle allows a qubit to exist in a linear combination of states |0⟩ and |1⟩?",
      options: [
        "Quantum Decoherece",
        "Quantum Superposition",
        "Pauli Exclusion Principle",
        "Doppler Effect"
      ],
      correctIndex: 1,
      explanation: "Superposition allows a quantum system to hold probability amplitudes for both 0 and 1 concurrently until a measurement collapses the state vector.",
      discipline: "Quantum Computing"
    },
    {
      id: 2,
      question: "Which quantum algorithm provides an exponential speedup for integer factorization, threatening RSA encryption?",
      options: [
        "Grover's Search Algorithm",
        "Shor's Algorithm",
        "Deutsch-Jozsa Algorithm",
        "VQE (Variational Quantum Eigensolver)"
      ],
      correctIndex: 1,
      explanation: "Shor's Algorithm finds the prime factors of an integer N in polynomial time O((log N)^3), providing an exponential speedup over classical algorithms.",
      discipline: "Quantum Computing"
    }
  ],
  space: [
    {
      id: 1,
      question: "What is the boundary around a black hole beyond which nothing, not even light, can escape called?",
      options: [
        "Photon Sphere",
        "Ergosphere",
        "Event Horizon",
        "Accretion Boundary"
      ],
      correctIndex: 2,
      explanation: "The Event Horizon is the point of no return where the escape velocity strictly equals the speed of light in a vacuum (c).",
      discipline: "Astrophysics & Space"
    },
    {
      id: 2,
      question: "Which orbit keeps a satellite stationary relative to a fixed point on Earth's surface?",
      options: [
        "Low Earth Orbit (LEO, ~400 km)",
        "Geostationary Orbit (GEO, ~35,786 km)",
        "Molniya Highly Elliptical Orbit",
        "Polar Sun-Synchronous Orbit"
      ],
      correctIndex: 1,
      explanation: "A circular geostationary orbit matches Earth's sidereal rotation period (23h 56m 4s) over the equator at approximately 35,786 kilometers altitude.",
      discipline: "Astrophysics & Space"
    }
  ]
};

const FLASHCARDS = [
  {
    term: "Vector Embeddings",
    discipline: "Machine Learning",
    summary: "Dense mathematical representations of data in high-dimensional vector space.",
    deepDive: "Embeddings capture semantic relationships such that concepts with similar contextual meaning (e.g., 'king' and 'queen') lie close to each other via Cosine or Dot-Product distance."
  },
  {
    term: "WebRTC Selective Forwarding Unit (SFU)",
    discipline: "Real-Time Networking",
    summary: "A server architecture that routes multimedia streams between clients without trans-coding.",
    deepDive: "Unlike an MCU (which mixes audio/video into a single feed at high CPU cost), an SFU forwards incoming RTP packets directly to connected peers, yielding sub-100ms real-time duplex latency."
  },
  {
    term: "PostgreSQL pgvector (HNSW Index)",
    discipline: "Database Architecture",
    summary: "Hierarchical Navigable Small World graphs for lightning-fast approximate nearest neighbor search.",
    deepDive: "HNSW constructs multi-layer geometric graphs to traverse vector space with logarithmic search time complexity O(log N), ideal for low-latency Rocky RAG queries."
  },
  {
    term: "Voice Activity Detection (Silero VAD)",
    discipline: "Speech Processing",
    summary: "A lightweight deep learning model that detects active human speech vs silence/noise.",
    deepDive: "Silero processes 30ms audio chunks in ~1ms CPU time, triggering state transitions between user listening and Rocky speech with near-zero false positive wakeups."
  }
];

export const StudyMatrixDrawer: React.FC<StudyMatrixDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'quiz' | 'socratic' | 'flashcards'>('quiz');
  const [selectedDiscipline, setSelectedDiscipline] = useState<'ai' | 'quantum' | 'space'>('ai');
  
  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Socratic Explorer State
  const [socraticTopic, setSocraticTopic] = useState('Gradient Descent Intuition');
  const [socraticResult, setSocraticResult] = useState<any>(null);

  // Flashcards State
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const questions = QUIZ_BANK[selectedDiscipline] || QUIZ_BANK.ai;
  const currentQ = questions[currentQuestionIndex] || questions[0];

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
    setIsAnswerSubmitted(true);
    if (index === currentQ.correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(i => i + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizFinished(true);
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setQuizFinished(false);
  };

  const handleExploreSocratic = (topic: string) => {
    setSocraticTopic(topic);
    if (topic.includes('Gradient')) {
      setSocraticResult({
        axiom: "A scalar objective function defines a topographic landscape of loss in parameter space.",
        analogy: "Imagine standing blindfolded on a foggy mountain peak trying to find the valley bottom. You feel the ground incline beneath your boots and take a step downhill.",
        mechanism: "Weights are updated in the opposite direction of the gradient: W_new = W_old - (alpha * grad_W).",
        challenge: "What happens if your learning rate (alpha) is too large? Why does momentum help escape saddle points?"
      });
    } else if (topic.includes('WebRTC') || topic.includes('SFU')) {
      setSocraticResult({
        axiom: "Media transmission requires synchronized UDP packets with real-time feedback (RTCP).",
        analogy: "An SFU acts like an intelligent airport baggage sorter: it inspects routing tags and immediately redirects flights without unpacking the luggage.",
        mechanism: "Clients send 1 uplink stream to the SFU, which distributes N downlinks without re-encoding.",
        challenge: "How does an SFU adapt when a downstream client experiences packet loss or constrained mobile bandwidth?"
      });
    } else {
      setSocraticResult({
        axiom: "Quantum superposition persists until irreversible thermodynamic interaction with the macroscopic environment.",
        analogy: "A spinning coin on a tabletop is both heads and tails until it strikes a surface and settles into a single definitive state.",
        mechanism: "State vector |psi> = alpha|0> + beta|1>, where |alpha|^2 + |beta|^2 = 1.",
        challenge: "Why does measuring a single entangled qubit instantly determine the state of its paired counterpart?"
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#020813]/70 backdrop-blur-sm"
        />

        {/* Drawer Container */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl h-full bg-[#020813]/95 border-l border-cyan-500/40 p-6 flex flex-col justify-between overflow-y-auto text-cyan-300 font-mono shadow-[0_0_50px_rgba(0,240,255,0.2)]"
        >
          {/* Header */}
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-cyan-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-cyan-950/80 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                  <GraduationCap className="text-cyan-400 animate-pulse" size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-orbitron font-bold text-cyan-200 tracking-wider">
                    STUDY.MATRIX // ACADEMY
                  </h2>
                  <p className="text-[10px] sm:text-xs text-cyan-500 tracking-widest uppercase">
                    Interactive AI Quiz, Socratic Tutor & Knowledge Deck
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-400 hover:text-cyan-200 transition-all"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 my-4 bg-cyan-950/40 p-1 rounded-lg border border-cyan-900/60">
              <button
                type="button"
                onClick={() => setActiveTab('quiz')}
                className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'quiz'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <Award size={14} />
                <span>AI QUIZ TERMINAL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('socratic');
                  if (!socraticResult) handleExploreSocratic(socraticTopic);
                }}
                className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'socratic'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <Compass size={14} />
                <span>SOCRATIC EXPLORER</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('flashcards')}
                className={`flex-1 py-1.5 text-[11px] font-orbitron font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'flashcards'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'text-cyan-500 hover:text-cyan-300'
                }`}
              >
                <BookOpen size={14} />
                <span>FLASHCARD DECK</span>
              </button>
            </div>

            {/* Tab 1: AI Quiz Terminal */}
            {activeTab === 'quiz' && (
              <div className="space-y-4">
                {/* Discipline Selector */}
                {!quizFinished && (
                  <div className="flex gap-2">
                    {[
                      { key: 'ai', label: 'AI & NEURAL' },
                      { key: 'quantum', label: 'QUANTUM' },
                      { key: 'space', label: 'ASTROPHYSICS' },
                    ].map(disc => (
                      <button
                        key={disc.key}
                        onClick={() => {
                          setSelectedDiscipline(disc.key as any);
                          handleResetQuiz();
                        }}
                        className={`px-3 py-1.5 text-[10px] font-orbitron rounded border uppercase transition-all ${
                          selectedDiscipline === disc.key
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                            : 'bg-cyan-950/30 border-cyan-900 text-cyan-600 hover:text-cyan-400'
                        }`}
                      >
                        {disc.label}
                      </button>
                    ))}
                  </div>
                )}

                {quizFinished ? (
                  /* Quiz Completed Screen */
                  <div className="p-6 rounded-lg bg-[#050f20]/90 border border-cyan-500/40 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                      <Award className="text-cyan-300" size={32} />
                    </div>
                    <div>
                      <h3 className="font-orbitron font-bold text-lg text-cyan-100">
                        ASSESSMENT COMPLETE
                      </h3>
                      <p className="text-xs text-cyan-500 uppercase tracking-widest mt-1">
                        Discipline: {currentQ.discipline}
                      </p>
                    </div>

                    <div className="p-4 rounded bg-cyan-950/50 border border-cyan-800/80 inline-block px-8">
                      <span className="text-[10px] text-cyan-600 block uppercase">FINAL SCORE</span>
                      <span className="text-2xl font-bold font-orbitron text-cyan-200">
                        {score} / {questions.length} ({Math.round((score / questions.length) * 100)}%)
                      </span>
                    </div>

                    <p className="text-xs text-cyan-400/90 font-sans max-w-md mx-auto">
                      {score === questions.length
                        ? "Flawless score, Commander. Conceptual fluency confirmed across all tested paradigms."
                        : score >= Math.ceil(questions.length / 2)
                        ? "Proficient assessment. Key concepts validated with minor calibration recommended."
                        : "Review recommended. Re-run study cards and explore Socratic axioms to reinforce."}
                    </p>

                    <button
                      onClick={handleResetQuiz}
                      className="px-6 py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-100 font-orbitron text-xs flex items-center justify-center gap-2 mx-auto transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    >
                      <RotateCcw size={14} />
                      <span>RETAKE ASSESSMENT</span>
                    </button>
                  </div>
                ) : (
                  /* Active Question Card */
                  <div className="p-5 rounded-lg bg-[#050f20]/90 border border-cyan-500/30 space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-orbitron text-cyan-500 border-b border-cyan-900/60 pb-2">
                      <span>QUESTION {currentQuestionIndex + 1} OF {questions.length}</span>
                      <span>DISCIPLINE // {currentQ.discipline.toUpperCase()}</span>
                    </div>

                    <h3 className="text-sm font-sans text-cyan-100 leading-relaxed font-semibold">
                      {currentQ.question}
                    </h3>

                    {/* Options Grid */}
                    <div className="space-y-2 pt-2">
                      {currentQ.options.map((opt, idx) => {
                        let btnStyle = "bg-cyan-950/40 border-cyan-900 text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-900/40";
                        if (isAnswerSubmitted) {
                          if (idx === currentQ.correctIndex) {
                            btnStyle = "bg-emerald-950/80 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.3)]";
                          } else if (idx === selectedOption) {
                            btnStyle = "bg-red-950/80 border-red-500 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.3)]";
                          } else {
                            btnStyle = "opacity-40 border-cyan-950 text-cyan-700";
                          }
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectOption(idx)}
                            disabled={isAnswerSubmitted}
                            className={`w-full p-3 rounded-lg border text-left text-xs font-sans transition-all flex items-start gap-3 ${btnStyle}`}
                          >
                            <span className="font-mono font-bold text-cyan-500 shrink-0 mt-0.5">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isAnswerSubmitted && idx === currentQ.correctIndex && (
                              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                            )}
                            {isAnswerSubmitted && idx === selectedOption && idx !== currentQ.correctIndex && (
                              <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Answer Explanation Box */}
                    {isAnswerSubmitted && (
                      <div className="p-3.5 rounded-lg bg-cyan-950/60 border border-cyan-700/60 text-xs font-sans text-cyan-200 space-y-1 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 font-bold font-orbitron text-cyan-300 text-[10px] uppercase">
                          <Lightbulb size={12} className="text-cyan-400" />
                          <span>Rocky Neural Explanation:</span>
                        </div>
                        <p className="text-cyan-300/90 leading-relaxed text-[11px]">
                          {currentQ.explanation}
                        </p>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={handleNextQuestion}
                            className="px-4 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-100 font-orbitron text-[10px] flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                          >
                            <span>{currentQuestionIndex + 1 === questions.length ? "FINALIZE SCORE" : "NEXT QUESTION"}</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Socratic Concept Explorer */}
            {activeTab === 'socratic' && (
              <div className="space-y-4">
                {/* Topic Presets */}
                <div className="space-y-2">
                  <span className="text-[10px] font-orbitron text-cyan-400 uppercase tracking-widest block">
                    CHOOSE SOCRATIC DISCIPLINE:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Gradient Descent Intuition",
                      "WebRTC SFU Media Pipeline",
                      "Quantum Superposition"
                    ].map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleExploreSocratic(topic)}
                        className={`px-3 py-1.5 rounded text-xs border font-sans transition-all ${
                          socraticTopic === topic
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                            : 'bg-cyan-950/40 border-cyan-900 text-cyan-500 hover:text-cyan-300'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                {socraticResult && (
                  <div className="space-y-3 p-4 rounded-lg bg-[#050f20]/90 border border-cyan-500/30 font-sans text-xs">
                    {/* Section 1: Axiom */}
                    <div className="p-3 rounded bg-cyan-950/50 border border-cyan-900">
                      <span className="text-[10px] font-orbitron font-bold text-cyan-400 uppercase block mb-1">
                        1. FOUNDATIONAL AXIOM
                      </span>
                      <p className="text-cyan-200 leading-relaxed">
                        {socraticResult.axiom}
                      </p>
                    </div>

                    {/* Section 2: Intuition & Analogy */}
                    <div className="p-3 rounded bg-cyan-950/50 border border-cyan-900">
                      <span className="text-[10px] font-orbitron font-bold text-emerald-400 uppercase block mb-1">
                        2. INTUITIVE ANALOGY
                      </span>
                      <p className="text-cyan-200 leading-relaxed">
                        {socraticResult.analogy}
                      </p>
                    </div>

                    {/* Section 3: Mathematical Mechanism */}
                    <div className="p-3 rounded bg-cyan-950/50 border border-cyan-900">
                      <span className="text-[10px] font-orbitron font-bold text-purple-400 uppercase block mb-1">
                        3. UNDERLYING MECHANISM
                      </span>
                      <code className="text-purple-200 font-mono text-[11px] block bg-purple-950/40 p-2 rounded border border-purple-900/60">
                        {socraticResult.mechanism}
                      </code>
                    </div>

                    {/* Section 4: Socratic Challenge */}
                    <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60">
                      <span className="text-[10px] font-orbitron font-bold text-amber-300 uppercase block mb-1 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-amber-400" />
                        <span>4. GUIDED THINKING CHALLENGE</span>
                      </span>
                      <p className="text-amber-200/90 leading-relaxed">
                        {socraticResult.challenge}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Flashcard Deck */}
            {activeTab === 'flashcards' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-orbitron text-cyan-500">
                  <span>CARD {flashcardIndex + 1} OF {FLASHCARDS.length}</span>
                  <span className="text-cyan-400 font-bold uppercase">{FLASHCARDS[flashcardIndex].discipline}</span>
                </div>

                {/* Flip Card Container */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="min-h-[220px] p-6 rounded-xl bg-gradient-to-br from-[#051329] to-[#020813] border-2 border-cyan-500/40 hover:border-cyan-400 cursor-pointer transition-all flex flex-col justify-between shadow-[0_0_20px_rgba(0,240,255,0.15)] group"
                >
                  <div className="space-y-2">
                    <span className="text-[9px] font-orbitron text-cyan-600 uppercase tracking-widest">
                      {isFlipped ? "DEEP ARCHITECTURE REVEALED" : "CONCEPT // TAP TO FLIP"}
                    </span>
                    <h3 className="text-base font-orbitron font-bold text-cyan-100 group-hover:text-cyan-300 transition-colors">
                      {FLASHCARDS[flashcardIndex].term}
                    </h3>
                  </div>

                  <div className="my-3 font-sans text-xs text-cyan-200/90 leading-relaxed">
                    {isFlipped ? FLASHCARDS[flashcardIndex].deepDive : FLASHCARDS[flashcardIndex].summary}
                  </div>

                  <div className="pt-2 border-t border-cyan-900/60 flex items-center justify-between text-[10px] text-cyan-500 font-mono">
                    <span>{isFlipped ? "CLICK TO VIEW SUMMARY" : "CLICK TO EXPAND DETAILED EXPLANATION"}</span>
                    <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-300" />
                  </div>
                </div>

                {/* Deck Navigation Controls */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setFlashcardIndex(i => (i > 0 ? i - 1 : FLASHCARDS.length - 1));
                    }}
                    className="px-4 py-2 rounded bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800 text-cyan-300 font-orbitron text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ChevronLeft size={14} />
                    <span>PREVIOUS</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setFlashcardIndex(i => (i + 1) % FLASHCARDS.length);
                    }}
                    className="px-4 py-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-100 font-orbitron text-xs flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                  >
                    <span>NEXT CARD</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-cyan-900/60 flex items-center justify-between">
            <span className="text-[10px] text-cyan-600 font-mono">
              ROCKY ACADEMY // ADAPTIVE PEDAGOGY
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-orbitron text-xs tracking-wider uppercase transition-all"
            >
              CLOSE TERMINAL
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StudyMatrixDrawer;
