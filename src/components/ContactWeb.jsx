import React, { useEffect, useRef, useState } from 'react';
import { User, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export default function ContactWeb({ contacts, connections, onSelectContact }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
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

  // Sync contacts and connections to physics nodes and links
  useEffect(() => {
    const nodeMap = new Map(nodes.map(n => [n.name, n]));
    
    const newNodes = contacts.map(c => {
      const existing = nodeMap.get(c.name);
      return {
        ...c,
        id: c.name,
        x: existing ? existing.x : dimensions.width / 2 + (Math.random() - 0.5) * 100,
        y: existing ? existing.y : dimensions.height / 2 + (Math.random() - 0.5) * 100,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0
      };
    });

    const newLinks = connections.map(conn => {
      return {
        ...conn,
        source: conn.from,
        target: conn.to
      };
    });

    setNodes(newNodes);
    setLinks(newLinks);
  }, [contacts, connections, dimensions.width, dimensions.height]);

  // Physics animation loop
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId;
    const kAttract = 0.04;
    const kRepel = 800;
    const kGravity = 0.02;
    const friction = 0.85;

    const updatePhysics = () => {
      setNodes(prevNodes => {
        const nMap = new Map(prevNodes.map(n => [n.name, n]));
        const forces = prevNodes.map(node => ({ fx: 0, fy: 0 }));

        // 1. Repulsion between all node pairs
        for (let i = 0; i < prevNodes.length; i++) {
          const nodeA = prevNodes[i];
          for (let j = i + 1; j < prevNodes.length; j++) {
            const nodeB = prevNodes[j];
            
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);

            if (dist < 250) {
              const force = kRepel / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              forces[i].fx -= fx;
              forces[i].fy -= fy;
              forces[j].fx += fx;
              forces[j].fy += fy;
            }
          }
        }

        // 2. Attraction along links
        links.forEach(link => {
          const sourceNode = nMap.get(link.from);
          const targetNode = nMap.get(link.to);
          if (!sourceNode || !targetNode) return;

          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const desiredDist = 120;
          const force = (dist - desiredDist) * kAttract;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          const srcIdx = prevNodes.findIndex(n => n.name === link.from);
          const tgtIdx = prevNodes.findIndex(n => n.name === link.to);

          if (srcIdx !== -1) {
            forces[srcIdx].fx += fx;
            forces[srcIdx].fy += fy;
          }
          if (tgtIdx !== -1) {
            forces[tgtIdx].fx -= fx;
            forces[tgtIdx].fy -= fy;
          }
        });

        // 3. Gravity pulling to the center of SVG frame
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;
        prevNodes.forEach((node, i) => {
          const dx = centerX - node.x;
          const dy = centerY - node.y;
          forces[i].fx += dx * kGravity;
          forces[i].fy += dy * kGravity;
        });

        const updated = prevNodes.map((node, i) => {
          if (draggedNode && node.name === draggedNode.name) {
            return node;
          }

          const vx = (node.vx + forces[i].fx) * friction;
          const vy = (node.vy + forces[i].fy) * friction;
          
          const speedLimit = 15;
          const currentSpeed = Math.sqrt(vx * vx + vy * vy);
          const finalVx = currentSpeed > speedLimit ? (vx / currentSpeed) * speedLimit : vx;
          const finalVy = currentSpeed > speedLimit ? (vy / currentSpeed) * speedLimit : vy;

          let nextX = node.x + finalVx;
          let nextY = node.y + finalVy;

          return {
            ...node,
            x: nextX,
            y: nextY,
            vx: finalVx,
            vy: finalVy
          };
        });

        return updated;
      });

      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    animationFrameId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes.length, links, draggedNode, dimensions]);

  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    const svgRect = containerRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
    const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
    
    setDraggedNode({
      name: node.name,
      offsetX: node.x - mouseX,
      offsetY: node.y - mouseY
    });
  };

  const handleMouseMove = (e) => {
    if (draggedNode) {
      const svgRect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
      const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
      
      setNodes(prev => prev.map(n => {
        if (n.name === draggedNode.name) {
          return {
            ...n,
            x: mouseX + draggedNode.offsetX,
            y: mouseY + draggedNode.offsetY,
            vx: 0,
            vy: 0
          };
        }
        return n;
      }));
    } else if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsPanning(false);
  };

  const handleBgMouseDown = (e) => {
    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y
    };
  };

  const handleZoom = (factor) => {
    setZoom(prev => Math.min(Math.max(prev * factor, 0.4), 3));
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const isConnected = (nodeName) => {
    if (!hoveredNode) return true;
    if (hoveredNode === nodeName) return true;
    return links.some(link => 
      (link.from === hoveredNode && link.to === nodeName) ||
      (link.to === hoveredNode && link.from === nodeName)
    );
  };

  return (
    <div className="panel" style={{ position: 'relative', flex: 1, height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Title bar */}
      <div className="panel-header" style={{ userSelect: 'none' }}>
        <span className="panel-title-text" style={{ color: 'var(--text-secondary)' }}>CONTACT NETWORK WEB</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => handleZoom(1.2)} 
            className="btn-icon"
            title="Zoom In"
          >
            <ZoomIn size={12} style={{ color: 'var(--text-primary)' }} />
          </button>
          <button 
            onClick={() => handleZoom(0.8)} 
            className="btn-icon"
            title="Zoom Out"
          >
            <ZoomOut size={12} style={{ color: 'var(--text-primary)' }} />
          </button>
          <button 
            onClick={resetView} 
            className="btn-icon"
            title="Recenter"
          >
            <Maximize2 size={12} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>
      </div>

      {/* Network Canvas Container */}
      <div 
        ref={containerRef} 
        style={{ flex: 1, width: '100%', position: 'relative', overflow: 'hidden', cursor: draggedNode ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleBgMouseDown}
      >
        {nodes.length === 0 ? (
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
              {/* Connection lines */}
              {links.map((link, idx) => {
                const sourceNode = nodes.find(n => n.name === link.from);
                const targetNode = nodes.find(n => n.name === link.to);
                if (!sourceNode || !targetNode) return null;

                const isHighlighted = hoveredNode === null || 
                  hoveredNode === link.from || 
                  hoveredNode === link.to;

                return (
                  <g key={`link-${idx}`} style={{ transition: 'opacity 0.3s' }}>
                    <line
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={isHighlighted ? "var(--text-primary)" : "var(--border-muted)"}
                      opacity={isHighlighted ? 0.7 : 0.2}
                      strokeWidth={isHighlighted ? 1.5 : 0.5}
                      strokeDasharray={link.type === 'Colleague' ? 'none' : '3 3'}
                    />
                    {isHighlighted && hoveredNode && (
                      <text
                        x={(sourceNode.x + targetNode.x) / 2}
                        y={(sourceNode.y + targetNode.y) / 2 - 4}
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

              {/* Node graphics */}
              {nodes.map((node) => {
                const highlighted = isConnected(node.name);
                const isHovered = hoveredNode === node.name;

                return (
                  <g
                    key={node.name}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
                    onMouseEnter={() => setHoveredNode(node.name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectContact(node);
                    }}
                    opacity={highlighted ? 1 : 0.25}
                  >
                    {/* Glowing outer circle on hover */}
                    <circle
                      r={isHovered ? 20 : 16}
                      fill="transparent"
                      stroke="var(--text-primary)"
                      strokeWidth={1}
                      strokeDasharray={isHovered ? "2 2" : "none"}
                    />
                    {/* Base Node */}
                    <circle
                      r={10}
                      fill={isHovered ? "var(--text-primary)" : "var(--bg-primary)"}
                      stroke="var(--text-primary)"
                      strokeWidth={2}
                    />
                    {/* Standard Label */}
                    <rect
                      x={-45}
                      y={20}
                      width={90}
                      height={18}
                      fill="var(--bg-primary)"
                      stroke={isHovered ? "var(--text-primary)" : "var(--border-muted)"}
                      strokeWidth={1}
                    />
                    <text
                      y={31}
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize="9px"
                      fontWeight="bold"
                      fontFamily="var(--font-mono)"
                    >
                      {node.name.length > 13 ? `${node.name.substring(0, 11)}..` : node.name}
                    </text>
                    
                    {/* Role & Company overlay on hover */}
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
                          {node.role || "Contact"}
                        </text>
                        <text
                          y={8}
                          textAnchor="middle"
                          fill="var(--text-secondary)"
                          fontSize="7px"
                          fontFamily="var(--font-mono)"
                        >
                          {node.company || "Unknown"}
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
      
      {/* Help message */}
      <div className="panel-footer">
        <span>DRAG TO ORGANIZE • HOVER TO HIGHLIGHT RELATIONS • CLICK FOR INFO</span>
        <span>NODES: {nodes.length}</span>
      </div>
    </div>
  );
}
