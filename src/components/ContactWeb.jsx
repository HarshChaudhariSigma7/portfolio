import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export default function ContactWeb({ contacts, connections, onSelectContact }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Update container dimensions on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 600,
          height: entry.contentRect.height || 500
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Determine active focus contact
  const focalContactName = useMemo(() => {
    if (contacts.length === 0) return null;
    
    // 1. If user clicked/selected a profile card, center around them
    // (We find it in the contacts list to confirm it still exists)
    // We can also let the visual click update it
    return contacts[0].name; // default fallback
  }, [contacts]);

  // Track the custom focal target inside the canvas to allow interactive re-centering
  const [canvasFocal, setCanvasFocal] = useState(null);

  // Sync canvas focal name when contacts load
  useEffect(() => {
    if (contacts.length > 0) {
      // Find node with the most connections to be the default center
      const connCounts = {};
      contacts.forEach(c => { connCounts[c.name] = 0; });
      connections.forEach(conn => {
        if (connCounts[conn.from] !== undefined) connCounts[conn.from]++;
        if (connCounts[conn.to] !== undefined) connCounts[conn.to]++;
      });

      let maxNode = contacts[0].name;
      let maxCount = -1;
      Object.entries(connCounts).forEach(([name, count]) => {
        if (count > maxCount) {
          maxCount = count;
          maxNode = name;
        }
      });
      setCanvasFocal(maxNode);
    } else {
      setCanvasFocal(null);
    }
  }, [contacts, connections]);

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;
  const R1 = 130; // Orbit 1 Radius (Direct connections)
  const R2 = 230; // Orbit 2 Radius (Indirect connections)

  // Calculate coordinates using deterministic orbit placement
  const nodePositions = useMemo(() => {
    if (contacts.length === 0 || !canvasFocal) return {};

    const positions = {};
    const focalName = canvasFocal;

    // Find direct neighbors of the focal node
    const directNeighbors = new Set();
    connections.forEach(conn => {
      if (conn.from.toLowerCase() === focalName.toLowerCase()) directNeighbors.add(conn.to);
      if (conn.to.toLowerCase() === focalName.toLowerCase()) directNeighbors.add(conn.from);
    });

    // Partition remaining nodes
    const orbit1Nodes = [];
    const orbit2Nodes = [];

    contacts.forEach(c => {
      if (c.name.toLowerCase() === focalName.toLowerCase()) {
        positions[c.name] = { x: cx, y: cy, orbit: 0, contact: c };
      } else if (directNeighbors.has(c.name)) {
        orbit1Nodes.push(c);
      } else {
        orbit2Nodes.push(c);
      }
    });

    // Arrange Orbit 1 (Direct)
    const count1 = orbit1Nodes.length;
    orbit1Nodes.forEach((c, idx) => {
      const angle = (idx / count1) * 2 * Math.PI;
      positions[c.name] = {
        x: cx + R1 * Math.cos(angle),
        y: cy + R1 * Math.sin(angle),
        orbit: 1,
        contact: c
      };
    });

    // Arrange Orbit 2 (Indirect)
    const count2 = orbit2Nodes.length;
    orbit2Nodes.forEach((c, idx) => {
      // Offset by PI/8 to stagger nodes and look more organic
      const angle = (idx / count2) * 2 * Math.PI + Math.PI / 8;
      positions[c.name] = {
        x: cx + R2 * Math.cos(angle),
        y: cy + R2 * Math.sin(angle),
        orbit: 2,
        contact: c
      };
    });

    return positions;
  }, [contacts, connections, canvasFocal, dimensions.width, dimensions.height]);

  // Drag pan handlers
  const handleBgMouseDown = (e) => {
    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoom = (factor) => {
    setZoom(prev => Math.min(Math.max(prev * factor, 0.4), 3));
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    // Recenter focal node
    if (contacts.length > 0) {
      setCanvasFocal(contacts[0].name);
    }
  };

  const isConnected = (nodeName) => {
    if (!hoveredNode) return true;
    if (hoveredNode.toLowerCase() === nodeName.toLowerCase()) return true;
    return connections.some(link => 
      (link.from.toLowerCase() === hoveredNode.toLowerCase() && link.to.toLowerCase() === nodeName.toLowerCase()) ||
      (link.to.toLowerCase() === hoveredNode.toLowerCase() && link.from.toLowerCase() === nodeName.toLowerCase())
    );
  };

  return (
    <div className="panel" style={{ position: 'relative', flex: 1, height: '100%', width: '100%', overflow: 'hidden', border: 'none' }}>
      {/* Floating Canvas Controls */}
      <div className="floating-controls select-none" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '8px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-muted)' }}>
        <button onClick={() => handleZoom(1.2)} className="btn-icon" title="Zoom In" style={{ border: 'none', background: 'transparent' }}>
          <ZoomIn size={16} style={{ color: 'var(--text-primary)' }} />
        </button>
        <button onClick={() => handleZoom(0.8)} className="btn-icon" title="Zoom Out" style={{ border: 'none', background: 'transparent' }}>
          <ZoomOut size={16} style={{ color: 'var(--text-primary)' }} />
        </button>
        <button onClick={resetView} className="btn-icon" title="Recenter" style={{ border: 'none', background: 'transparent' }}>
          <Maximize2 size={16} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* Canvas */}
      <div 
        ref={containerRef} 
        style={{ flex: 1, width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleBgMouseDown}
      >
        {contacts.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', userSelect: 'none', color: 'var(--text-muted)' }}>
            <User size={32} style={{ marginBottom: '8px', strokeWidth: 1 }} />
            <p style={{ fontSize: '12px', fontWeight: 'bold' }}>NO CONTACTS PARSED YET</p>
            <p style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>Upload unstructured texts on the left to build the web</p>
          </div>
        ) : (
          <svg 
            width={dimensions.width} 
            height={dimensions.height}
            style={{ width: '100%', height: '100%', userSelect: 'none' }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              
              {/* Background guides / Concentric Radar rings */}
              <circle 
                cx={cx} 
                cy={cy} 
                r={R1} 
                fill="none" 
                stroke="var(--border-muted)" 
                strokeWidth={1} 
                strokeDasharray="4 4" 
              />
              <circle 
                cx={cx} 
                cy={cy} 
                r={R2} 
                fill="none" 
                stroke="var(--border-muted)" 
                strokeWidth={0.7} 
                strokeDasharray="2 6" 
              />
              
              {/* Connection lines (drawn as inward curved Bézier curves) */}
              {connections.map((link, idx) => {
                const posA = nodePositions[link.from];
                const posB = nodePositions[link.to];
                if (!posA || !posB) return null;

                const isHighlighted = hoveredNode === null || 
                  hoveredNode.toLowerCase() === link.from.toLowerCase() || 
                  hoveredNode.toLowerCase() === link.to.toLowerCase();

                // Compute inward-bending control point for Bézier curve
                const midX = (posA.x + posB.x) / 2;
                const midY = (posA.y + posB.y) / 2;
                
                // Curve slightly towards the focal center (cx, cy)
                const curveFactor = 0.25; // How much it bends
                const ctrlX = midX + (cx - midX) * curveFactor;
                const ctrlY = midY + (cy - midY) * curveFactor;

                return (
                  <g key={`link-${idx}`} style={{ transition: 'opacity 0.3s' }}>
                    <path
                      d={`M ${posA.x} ${posA.y} Q ${ctrlX} ${ctrlY} ${posB.x} ${posB.y}`}
                      fill="none"
                      stroke={isHighlighted ? "var(--text-primary)" : "var(--border-muted)"}
                      opacity={isHighlighted ? 0.65 : 0.15}
                      strokeWidth={isHighlighted ? 1.2 : 0.4}
                      strokeDasharray={link.type === 'Colleague' ? 'none' : '2 2'}
                      style={{ transition: 'stroke 0.5s ease, stroke-width 0.5s ease' }}
                    />
                    {isHighlighted && hoveredNode && (
                      <text
                        x={ctrlX}
                        y={ctrlY - 4}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize="8px"
                        fontWeight="bold"
                        fontFamily="var(--font-mono)"
                      >
                        {link.type}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Node elements */}
              {Object.entries(nodePositions).map(([name, pos]) => {
                const highlighted = isConnected(name);
                const isHovered = hoveredNode === name;
                const isFocal = canvasFocal === name;

                return (
                  <g
                    key={name}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s'
                    }}
                    onMouseEnter={() => setHoveredNode(name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCanvasFocal(name); // Centering node in orbit layout
                      onSelectContact(pos.contact);
                    }}
                    opacity={highlighted ? 1 : 0.2}
                  >
                    {/* Ring highlight */}
                    <circle
                      r={isHovered ? 18 : isFocal ? 14 : 12}
                      fill="transparent"
                      stroke="var(--text-primary)"
                      strokeWidth={1}
                      strokeDasharray={isHovered ? "2 2" : "none"}
                      style={{ transition: 'r 0.3s ease' }}
                    />
                    {/* Inner point */}
                    <circle
                      r={isFocal ? 7 : 5}
                      fill={isHovered || isFocal ? "var(--text-primary)" : "var(--bg-primary)"}
                      stroke="var(--text-primary)"
                      strokeWidth={2}
                    />
                    
                    {/* Text Label Box */}
                    <g transform="translate(0, 16)">
                      {/* Box border */}
                      <rect
                        x={-45}
                        y={-8}
                        width={90}
                        height={16}
                        fill="var(--bg-primary)"
                        stroke={isHovered || isFocal ? "var(--text-primary)" : "var(--border-muted)"}
                        strokeWidth={1}
                        style={{ transition: 'stroke 0.3s ease' }}
                      />
                      <text
                        y={3}
                        textAnchor="middle"
                        fill="var(--text-primary)"
                        fontSize="8px"
                        fontWeight={isFocal ? 'bold' : 'normal'}
                        fontFamily="var(--font-mono)"
                      >
                        {name.length > 13 ? `${name.substring(0, 11)}..` : name}
                      </text>
                    </g>
                    
                    {/* Floating mini details overlay on hover */}
                    {isHovered && (
                      <g transform="translate(0, -32)">
                        <rect
                          x={-60}
                          y={-12}
                          width={120}
                          height={26}
                          fill="var(--bg-tertiary)"
                          stroke="var(--border-color)"
                          strokeWidth={1}
                        />
                        <text
                          y={-1}
                          textAnchor="middle"
                          fill="var(--text-primary)"
                          fontSize="8px"
                          fontWeight="bold"
                          fontFamily="var(--font-mono)"
                        >
                          {pos.contact.role || "Contact"}
                        </text>
                        <text
                          y={8}
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize="7px"
                          fontFamily="var(--font-mono)"
                        >
                          {pos.contact.company || "Unknown"}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
      
      {/* Footer */}
      <div className="panel-footer" style={{ justifyContent: 'flex-end' }}>
        <span>Nodes: {contacts.length}</span>
      </div>
    </div>
  );
}
