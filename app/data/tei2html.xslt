<?xml version="1.0" ?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="http://www.tei-c.org/ns/1.0"
  >
  <xsl:output method="xml" version="1.0" encoding="utf-8" indent="yes"/>

  <!-- IdentityTransform -->

  <xsl:template name="mark-up-every-character">
      <xsl:param name="text"/>
      <xsl:choose>
        <xsl:when test="normalize-space(substring($text, 1, 1)) = ''"><xsl:text> </xsl:text></xsl:when>
        <xsl:otherwise>
          <span class="sign" data-idx="0"><xsl:value-of select="substring($text, 1, 1)"/></span>
        </xsl:otherwise>
      </xsl:choose>

      <xsl:if test="string-length($text) > 1">
          <xsl:call-template name="mark-up-every-character">
              <xsl:with-param name="text" select="substring($text, 2, string-length($text) - 1)"/>
          </xsl:call-template>
      </xsl:if>
  </xsl:template>

  <xsl:template match="/">
    <xsl:apply-templates select="//tei:text/tei:body/tei:div[@type='edition']"/>
  </xsl:template>

  <xsl:template match="*">
    <xsl:apply-templates select="node()" />
  </xsl:template>

  <xsl:template match="text()">
    <xsl:call-template name="mark-up-every-character">
      <xsl:with-param name="text" select="."/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="tei:lb" priority="1">
    <br/>
  </xsl:template>

  <xsl:template match="tei:ex">
  </xsl:template>

  <xsl:template match="*[@xml:id]">
    <span class="word" id="{@xml:id}">
      <xsl:apply-templates />
    </span>
  </xsl:template>

</xsl:stylesheet>
